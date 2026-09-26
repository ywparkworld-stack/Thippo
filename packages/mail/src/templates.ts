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

  bookingConfirmedGuest(
    ctx: TemplateContext,
    data: { name: string; orderNumber: string; lines: BookingLine[]; total: string },
  ): Rendered {
    return {
      subject: `【thippo】ご予約が確定しました（注文番号 ${data.orderNumber}）`,
      text: withSignature(
        `
${data.name} 様

ご予約ありがとうございます。お支払いが完了し、ご予約が確定しました。

■ 注文番号
${data.orderNumber}

■ ご予約の内容
${formatLines(data.lines)}

■ お支払い金額（税込）
${data.total}

予約の確認・キャンセル・領収書の表示は、マイページの予約履歴から行えます。
${ctx.guestUrl}/mypage/orders

■ キャンセル規定
・利用開始の2時間前まで：全額返金
・利用開始の2時間前から利用開始まで：利用料金の半額を返金
・利用開始後：返金なし
（詳しくは ${ctx.guestUrl}/cancel-policy をご覧ください）
`,
        ctx,
      ),
    };
  },

  bookingConfirmedHost(
    ctx: TemplateContext,
    data: { companyName: string; orderNumber: string; guestName: string; lines: BookingLine[] },
  ): Rendered {
    return {
      subject: `【thippo】新しい予約が入りました（注文番号 ${data.orderNumber}）`,
      text: withSignature(
        `
${data.companyName} ご担当者様

新しい予約が確定しました。

■ 注文番号
${data.orderNumber}

■ 利用者
${data.guestName} 様

■ 予約の内容
${formatLines(data.lines)}

予約の詳細は貸出主センターの予約管理からご確認ください。
`,
        ctx,
      ),
    };
  },

  latePaymentRefunded(
    ctx: TemplateContext,
    data: { name: string; orderNumber: string; total: string },
  ): Rendered {
    return {
      subject: `【thippo】お支払いを返金しました（注文番号 ${data.orderNumber}）`,
      text: withSignature(
        `
${data.name} 様

注文番号 ${data.orderNumber} は、お支払いの手続きの期限（15分）を過ぎていたため、ご予約を確定できませんでした。
お支払いいただいた ${data.total} は全額返金いたします。カード会社によっては、返金の反映まで時間がかかる場合があります。

お手数ですが、もう一度ご予約の手続きをお願いいたします。
${ctx.guestUrl}/
`,
        ctx,
      ),
    };
  },
} as const;

export interface BookingLine {
  spaceName: string;
  /** 例: 2026/10/01(木) 10:00〜11:30 */
  when: string;
  address: string;
  /** 例: ¥3,000 */
  amount: string;
}

function formatLines(lines: BookingLine[]): string {
  return lines
    .map((l) => `・${l.spaceName}\n  ${l.when}\n  ${l.address}\n  ${l.amount}`)
    .join("\n");
}

export type TemplateName = keyof typeof templates;
export type TemplateData<T extends TemplateName> = Parameters<(typeof templates)[T]>[1];
