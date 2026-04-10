import axios from 'axios';

/**
 * Escape Markdown characters for Telegram MarkdownV2
 */
export function escapeMarkdownV2(text: string): string {
    if (!text) return '';
    // MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export const TEL_SEP = '\\-\\-\\-\\-\\-\\-\\-\\-\\-\\-\\-\\-\\-\\-\\-\\-\\-\\-';

/**
 * Send Slack Notification
 */
export async function sendSlackNotification(payload: any, webhookUrl?: string) {
    if (!webhookUrl || webhookUrl.trim() === '' || webhookUrl === '********') {
        console.warn('Slack Webhook URL not configured');
        return false;
    }

    try {
        console.log('Sending Slack notification...');
        await axios.post(webhookUrl, payload, { timeout: 5000 });
        console.log('Slack notification sent successfully');
        return true;
    } catch (e: any) {
        console.error('Failed to send Slack notification:', e.message);
        return false;
    }
}

/**
 * Send Telegram Notification
 */
export async function sendTelegramNotification(message: string, botToken?: string, chatId?: string) {
    if (!botToken || !chatId || botToken.trim() === '' || chatId.trim() === '' || botToken === '********' || chatId === '********') {
        console.warn('Telegram Bot Token or Chat ID not configured');
        return false;
    }

    try {
        console.log(`Sending Telegram notification to ${chatId}...`);
        const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'MarkdownV2',
        }, { timeout: 10000 });

        console.log('Telegram notification sent successfully:', response.status);
        return true;
    } catch (e: any) {
        console.error('Failed to send Telegram notification:', e.response?.data || e.message);
        return false;
    }
}

/**
 * Send Lead Discovery Notification
 */
export async function sendLeadNotification(
    lead: {
        title: string;
        company: string;
        score: number;
        angle: string;
        link: string;
        email?: string;
        phone?: string;
    },
    config: {
        slackUrl?: string;
        telegramToken?: string;
        telegramChatId?: string;
    }
) {
    const { slackUrl, telegramToken, telegramChatId } = config;

    // 1. Prepare Slack Payload
    const slackPayload = {
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `🎯 새로운 고점수 광고주 후보 발견! (${lead.score}점)`,
                    emoji: true,
                },
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*기업명:*\n${lead.company}` },
                    { type: 'mrkdwn', text: `*점수:*\n${lead.score}점` },
                ],
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*기사제목:*\n<${lead.link}|${lead.title}>` },
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*영업전략:*\n${lead.angle}` },
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*이메일:*\n${lead.email || '-'}` },
                    { type: 'mrkdwn', text: `*연락처:*\n${lead.phone || '-'}` },
                ],
            },
        ],
    };

    // 2. Prepare Telegram Message
    const safeTitle = escapeMarkdownV2(lead.title);
    const safeCompany = escapeMarkdownV2(lead.company);
    const safeAngle = escapeMarkdownV2(lead.angle);
    const safeEmail = escapeMarkdownV2(lead.email || '-');
    const safePhone = escapeMarkdownV2(lead.phone || '-');
    const safeLink = lead.link; // Link itself shouldn't be escaped if used in [text](link)

    const telegramMessage = `
🎯 *새로운 고점수 광고주 후보 발견\\!*
${TEL_SEP}
🏢 *기업:* ${safeCompany}
⭐ *점수:* ${lead.score}점
${TEL_SEP}
📰 *기사:* [${safeTitle}](${safeLink})
💡 *전략:* ${safeAngle}
${TEL_SEP}
📧 *이메일:* ${safeEmail}
📞 *연락처:* ${safePhone}
  `.trim();

    // 3. Send Notifications (Parallel)
    const results = await Promise.allSettled([
        sendSlackNotification(slackPayload, slackUrl),
        sendTelegramNotification(telegramMessage, telegramToken, telegramChatId),
    ]);

    return results;
}
