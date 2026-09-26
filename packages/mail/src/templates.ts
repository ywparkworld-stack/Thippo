/**
 * メールの文面（SPEC §12）。運営が文面を直すときはこのファイルだけを変更する。
 * 会員登録の確認・パスワード再設定・貸出主の招待のメールは Supabase Auth が送るため、
 * 文面は supabase/templates/*.html にある。
 *
 * 文面はプレーンテキスト。差し込む値は呼び出し側で整形済みの文字列を渡す。
 */

const SIGNATURE = `
--
thippo（ティッポ）
このメールは送信専用です。お問い合わせは {contactUrl} からお願いします。
`;

export interface TemplateContext {
  /** 利用者サイトの URL（末尾のスラッシュなし） */
  guestUrl: string;
  /** お問い合わせページの URL */
  contactUrl: string;
}

type Rendered = { subject: string; text: string };

function withSignature(body: string, ctx: TemplateContext): string {
  return `${body.trim()}\n${SIGNATURE.replace("{contactUrl}", ctx.contactUrl)}`;
}

export const templates = {
  identityApproved(ctx: TemplateContext, data: { name: string }): Rendered {
    return {
      subject: "【thippo】本人確認が完了しました",
      text: withSignature(
        `
${data.name} 様

本人確認書類の確認が完了しました。
スペースのご予約ができるようになりました。

${ctx.guestUrl}/
`,
        ctx,
      ),
    };
  },

  identityRejected(
    ctx: TemplateContext,
    data: { name: string; reason: string; backSideRequested: boolean },
  ): Rendered {
    const back = data.backSideRequested
      ? "\n再提出の際は、書類の表面と裏面の両方の画像を添付してください（マイナンバーカードは裏面を提出できないため、別の書類をお選びください）。\n"
      : "";
    return {
      subject: "【thippo】本人確認書類を再提出してください",
      text: withSignature(
        `
${data.name} 様

ご提出いただいた本人確認書類を確認できませんでした。
お手数ですが、マイページから書類を再提出してください。

■ 理由
${data.reason}
${back}
${ctx.guestUrl}/mypage/identity
`,
        ctx,
      ),
    };
  },

  hostApplicationReceived(
    ctx: TemplateContext,
    data: { contactName: string; companyName: string },
  ): Rendered {
    return {
      subject: "【thippo】掲載のお申し込みを受け付けました",
      text: withSignature(
        `
${data.companyName}
${data.contactName} 様

thippo へのスペース掲載のお申し込みを受け付けました。
内容を確認のうえ、運営よりご連絡いたします。

承認されると、貸出主センターへの招待メールが届きます。
`,
        ctx,
      ),
    };
  },

  hostApplicationAdminNotice(
    ctx: TemplateContext,
    data: {
      companyName: string;
      contactName: string;
      email: string;
      phone: string;
      address: string;
      note: string;
    },
  ): Rendered {
    return {
      subject: `【thippo 運営】掲載申込がありました：${data.companyName}`,
      text: `
新しい掲載申込があります。運営管理の「掲載申込」から審査してください。

会社名：${data.companyName}
担当者：${data.contactName}
メール：${data.email}
電話：${data.phone}
所在地：${data.address}
備考：
${data.note || "（なし）"}
`.trim(),
    };
  },
} as const;

export type TemplateName = keyof typeof templates;
export type TemplateData<T extends TemplateName> = Parameters<(typeof templates)[T]>[1];
