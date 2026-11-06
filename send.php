<?php
/**
 * Приём заявок с формы «ЗАПИСАТЬСЯ» (fetch POST: name, phone).
 * Отправляет письмо и/или сообщение в Telegram. Ответ — JSON { ok: bool, error?: string }.
 *
 * НАСТРОЙКА: заполните хотя бы один канал ниже.
 */

// [TODO: почта для заявок] — например 'info@example.ru'. Пусто = письмо не отправляется.
const MAIL_TO = '';

// [TODO: Telegram для заявок] — токен бота от @BotFather и chat_id получателя/группы.
// Пусто = Telegram не используется.
const TG_BOT_TOKEN = '';
const TG_CHAT_ID   = '';

// ---------------------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
date_default_timezone_set('Europe/Moscow');

function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'method']);
}

// Ловушка для ботов: настоящий человек это поле не видит и не заполняет
if (trim((string)($_POST['website'] ?? '')) !== '') {
    respond(200, ['ok' => true]);
}

$name  = trim(preg_replace('/[\r\n\t]+/u', ' ', (string)($_POST['name'] ?? '')));
$phone = trim(preg_replace('/[\r\n\t]+/u', ' ', (string)($_POST['phone'] ?? '')));
$digits = preg_replace('/\D+/', '', $phone);

if ($name === '' || mb_strlen($name, 'UTF-8') > 100 || strlen($digits) < 10 || strlen($digits) > 15 || mb_strlen($phone, 'UTF-8') > 30) {
    respond(422, ['ok' => false, 'error' => 'invalid']);
}

$useMail = MAIL_TO !== '';
$useTg   = TG_BOT_TOKEN !== '' && TG_CHAT_ID !== '';
if (!$useMail && !$useTg) {
    respond(500, ['ok' => false, 'error' => 'not_configured']);
}

$when = date('d.m.Y H:i');
$text = "Заявка с сайта Volnewmer\nИмя: {$name}\nТелефон: {$phone}\nДата: {$when}";
$sent = false;

if ($useMail) {
    $host    = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
    $host    = preg_replace('/^www\./i', '', $host);
    $subject = '=?UTF-8?B?' . base64_encode('Заявка с сайта Volnewmer') . '?=';
    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'From: =?UTF-8?B?' . base64_encode('Сайт Volnewmer') . '?= <no-reply@' . $host . '>',
    ]);
    $sent = @mail(MAIL_TO, $subject, $text, $headers) || $sent;
}

if ($useTg) {
    $url  = 'https://api.telegram.org/bot' . TG_BOT_TOKEN . '/sendMessage';
    $html = "<b>Заявка с сайта Volnewmer</b>\nИмя: " . htmlspecialchars($name, ENT_QUOTES, 'UTF-8')
          . "\nТелефон: " . htmlspecialchars($phone, ENT_QUOTES, 'UTF-8')
          . "\nДата: " . $when;
    $payload = http_build_query(['chat_id' => TG_CHAT_ID, 'text' => $html, 'parse_mode' => 'HTML']);
    $resp = false;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
        ]);
        $resp = curl_exec($ch);
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => [
            'method'  => 'POST',
            'header'  => 'Content-Type: application/x-www-form-urlencoded',
            'content' => $payload,
            'timeout' => 10,
        ]]);
        $resp = @file_get_contents($url, false, $ctx);
    }
    $data = is_string($resp) ? json_decode($resp, true) : null;
    $sent = (!empty($data['ok'])) || $sent;
}

if ($sent) {
    respond(200, ['ok' => true]);
}
respond(502, ['ok' => false, 'error' => 'send_failed']);
