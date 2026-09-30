# Design — Chia bill nhóm

Source of truth for how the app looks and behaves. The code in `src/` implements this. When they disagree, update both or record why here.

- **Live design canvas (Claude Design):** https://claude.ai/code/artifact/3712e4d0-9fb3-4047-a321-04fc3d27dda4. It's private to Tan and has 3 artboards: the flow and screen list, a mobile prototype, and a desktop prototype.
- **Design system:** Plenti Design System, https://claude.ai/code/artifact/5e182beb-717b-45d0-91eb-4b08e03f1b72. `tokens.json` in this folder is a copy.
- `canvas/`: source of the canvas artboards (`*.dc.html` + `canvas.json`). These files only render inside the Claude Design canvas; they won't open standalone in a browser. Treat them as reference for layout, copy and behaviour.
- `screenshots/`: the implemented app (mobile 390px, desktop 1366px, one dark-mode shot).

## Product in one line

One organiser creates a party, adds members and bills, and shares one link. Everyone opens it, picks "Tôi là…", scans the organiser's QR, and taps "Đã trả".

## Screens & flow

Organiser wizard (route `#/p/:id/sua?k=KEY`), 6 steps with a progress indicator:

| # | Step | Key content |
|---|---|---|
| 1 | Tạo buổi tiệc | name (required), date, cover icon (6), theme colour (6), live preview card |
| 2 | Thêm thành viên | type + Enter, paste a comma/line list, rename, cycle avatar colour, star = organiser, delete (confirm dialog if the member is used in bills). Needs ≥ 2 members |
| 3 | Thêm hóa đơn | bill cards (tap = edit, swipe left = delete with Undo toast), empty state, sticky "Thêm hóa đơn". Opens the Bill editor |
| 4 | Tổng kết | total hero card; "Ai trả cho ai" with a mode switch; per-person and per-bill accordions |
| 5 | Mã QR thanh toán | one card per receiver, organiser first. Default tab "Ảnh QR có sẵn" (upload); alternative "Tạo VietQR". Bank select, account number with copy, account holder |
| 6 | Chia sẻ | public link + QR of the link, copy, Zalo / Messenger / native share, organiser link, payment status list, success confetti when all are paid |

**Bill editor** (bottom sheet on mobile, centred 580px modal on desktop), top to bottom: name + quick chips → amount (quick +50k/+100k/+200k/+500k) → payer (radio chips) → participants (multi chips, "Chọn tất cả / Bỏ chọn tất cả") → split mode (Chia đều / Theo số tiền / Theo %, with live remaining badge) → **Tài trợ · không bắt buộc** (dashed switch row, off by default; Bao trọn / Tài trợ một phần) → note + receipt photo → live "Mỗi người trả" preview.

**Viewer** (routes `#/p/:id` or `#/v/:data`): read-only.
- "Tôi là…" chips, remembered per party.
- A hero card with the person's net amount.
- One card per outgoing transfer: QR (uploaded image, else auto VietQR), bank details, transfer note, "Sao chép số tài khoản", "Tôi đã trả".
- Incoming transfers, the person's share per bill, and the list of all transfers.

**Home** (`#/`): create new, "Thử với dữ liệu mẫu", list of my parties.

## Business rules

- VND, format `1.250.000đ`, no decimals.
- Sponsorship (optional) is taken off first. Full: sponsors split the whole bill. Fixed: each sponsor pays `sponsorAmount`.
- The remainder is split among participants. Equal and % shares round to the nearest 1.000đ. The difference goes to the payer, or to the first participant if the payer didn't join.
- **Chỉ tài trợ (sponsor-only), optional per sponsor:** ticked in the bill editor under each selected sponsor; stored on the member, so it applies to every bill. That member pays only what they sponsor and is left out of the remaining split on all bills. Example: 3 people, bills of 2M and 4M, P1 sponsors 1M of bill 1 and ticks it, so P2 and P3 each pay (2 + 4 − 1) / 2 = 2.5M.
- Validation: amount > 0; at least 1 participant; custom amounts must sum to the remainder; percentages must total 100; a partial sponsorship needs an amount that doesn't exceed the bill.
- **Settlement default = "Qua người tổ chức":** debtors pay the organiser, then the organiser pays back creditors. This is how groups actually pay in practice, so usually only the organiser's QR is needed. The optional "Ít lần chuyển nhất" mode uses greedy debt simplification.
- Transfer note for VietQR: `"<Payer> tra <Receiver>"` in ASCII, max 25 chars.

## Visual language

- Colours come from the Plenti DS: primary navy `#002a61`, accent blue `#3c66ff` / text blue `#0b36d2`, warm-grey neutrals, and the semantic positive, warning (used for sponsor badges) and danger families. The dark theme is derived. All variables are in `src/styles.css`.
- Type: **Inter** 400/600/700 everywhere. The DS heading font Satoshi was skipped because it lacks full Vietnamese diacritics.
- Radii: cards 16px, inputs 8px, buttons and chips fully rounded (pill), modals 16px.
- Shadows are soft `#5d656f` at 12–16%. In dark mode they become a 1px ring.
- Icons are inline stroke SVGs (24 grid, 2px). **No emoji**, per the DS; the sponsor badge uses a gift icon.
- Avatars are coloured circles showing the initial of the *last* word of the name (Vietnamese given name). There are 8 fixed dark fills, and white text passes 4.5:1 contrast.
- Mobile-first with 44px minimum tap targets and a sticky bottom action bar.
- Desktop (≥ 1024px) is a 3-column grid: step sidebar (272px), content (max 680px), live summary aside (340px).
- Motion is tweens of 0.2–0.4s ease-out: sheet slide-up, toast, pop, and confetti on "all paid". `prefers-reduced-motion` is respected.

## Copy (Vietnamese)

- Friendly and short, second person ("bạn"), e.g. "Chưa có hóa đơn nào", "Thêm hóa đơn đầu tiên nhé!".
- Buttons are verbs: "Tiếp tục", "Lưu hóa đơn", "Sao chép link", "Tôi đã trả".
- Validation messages say exactly what to do: "Nhập số tiền lớn hơn 0.", "Chọn ít nhất 1 người tham gia."

## Changes made after the first prototype (user feedback)

1. Button label colour bug: a generic `button { color: inherit }` rule beat `.btn-p`. Generic resets now sit inside `:where()`.
2. Sponsorship is clearly optional, moved below the split section, and styled lighter.
3. Settlement defaults to paying through the organiser; the organiser is picked with a star on the members step.
4. The QR step defaults to "Ảnh QR có sẵn".
5. Added a desktop layout.
6. Added a "chỉ tài trợ" option, so a sponsor can opt out of splitting the rest (see Business rules).
