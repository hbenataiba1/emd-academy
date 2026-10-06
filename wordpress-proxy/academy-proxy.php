<?php
/**
 * Reverse proxy: serves the Vercel-hosted academy app under
 * https://easymedicaldevice.com/academy
 *
 * Upload to the WordPress root (public_html), next to wp-config.php.
 * Requests are routed here by the rules in htaccess-snippet.txt.
 */

const ORIGIN = 'https://emd-academy-amber.vercel.app';

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

// Only ever proxy the academy paths.
if (!preg_match('#^/(academy|academy-assets|api/academy|api/checkout)(/|$)#', $path)) {
    http_response_code(404);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$body = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)
    ? file_get_contents('php://input')
    : null;

// Forward the useful request headers.
$forward = [];
$pass = ['accept', 'accept-language', 'authorization', 'content-type', 'cookie', 'user-agent', 'range', 'if-none-match'];
foreach (getallheaders() as $name => $value) {
    if (in_array(strtolower($name), $pass, true)) {
        $forward[] = "$name: $value";
    }
}
if (!empty($_SERVER['HTTP_AUTHORIZATION']) || !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $forward[] = 'Authorization: ' . ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
}
$forward[] = 'X-Forwarded-Host: ' . $_SERVER['HTTP_HOST'];
$forward[] = 'X-Forwarded-Proto: https';

$responseHeaders = [];
$ch = curl_init(ORIGIN . $uri);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $forward,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_ENCODING => '',            // let cURL decode gzip/br itself
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$responseHeaders) {
        $len = strlen($line);
        $parts = explode(':', $line, 2);
        if (count($parts) === 2) {
            $responseHeaders[] = [trim($parts[0]), trim($parts[1])];
        }
        return $len;
    },
]);
if ($body !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$content = curl_exec($ch);
if ($content === false) {
    http_response_code(502);
    echo 'Academy is temporarily unavailable.';
    exit;
}
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

http_response_code($status);

$skip = ['transfer-encoding', 'content-encoding', 'content-length', 'connection', 'keep-alive', 'server', 'strict-transport-security'];
foreach ($responseHeaders as [$name, $value]) {
    $lower = strtolower($name);
    if (in_array($lower, $skip, true)) {
        continue;
    }
    if ($lower === 'location') {
        $value = str_replace(ORIGIN, 'https://' . $_SERVER['HTTP_HOST'], $value);
    }
    header("$name: $value", $lower !== 'set-cookie');
}

echo $content;
