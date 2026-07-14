// ponytail: Helper untuk mengirimkan notifikasi instan ke Telegram menggunakan bot token dan chat ID dari file env
export async function sendTelegramNotification(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("[Telegram] Skip sending notification: Bot Token or Chat ID not configured in env");
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    const json = await res.json();
    if (!json.ok) {
      console.error("[Telegram] Error sending message:", json.description);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Telegram] Failed to send notification:", err);
    return false;
  }
}
