# L7-B — QA Test Script: Checkout via Telegram Stars

**Issue:** #268  
**Requires:** Real Telegram Stars + physical device with Telegram  
**Precondition:** Test account exists; app accessible via `t.me/<bot>?startapp=…`

---

## Environment setup

1. Open the mini-app in Telegram (not browser preview).
2. Confirm user is **not Pro** initially (no Pro badge on Dashboard/Profile).
3. Have at least 990 ⭐ available in your Telegram wallet (or use a 1 ⭐ test product if whitelisted).

---

## Scenario 1 — Happy path: purchase via Pro-locked module

| Step | Action | Expected result |
|------|--------|-----------------|
| 1.1 | Tap any Pro-locked module tile on Dashboard | Bottom sheet slides up from bottom (280ms ease-out); backdrop fades in |
| 1.2 | Verify paywall content | Mascot visible; star ★ animates in; bullet list with 4 items; 3 plan cards (Year recommended with gold «лучший выбор» pill) |
| 1.3 | Verify CTA button | Text «Купить за 990 ⭐»; subtext «ვარსკვლავი · звезда» visible below price in Georgian font |
| 1.4 | Tap «Купить за 990 ⭐» | Button shows loading state; then Telegram native Stars invoice opens |
| 1.5 | Complete payment in Telegram | Invoice closes; success toast appears at top of screen |
| 1.6 | Verify success toast | Gold background (#F5B820); text «★ Добро пожаловать в Pro!» + «ყველა მოდული ღიაა»; auto-dismisses after 3.5s |
| 1.7 | Verify Dashboard after payment | All Pro-locked module badges (★ Про) are gone; tile opacity 100%; tapping module opens it directly |

---

## Scenario 2 — Cancel at invoice

| Step | Action | Expected result |
|------|--------|-----------------|
| 2.1 | Open paywall → tap «Купить» | Telegram invoice opens |
| 2.2 | Tap Cancel / Back in Telegram | Returns to paywall in `default` state (plan cards visible, no error shown) |
| 2.3 | Verify state | User is still not Pro; paywall still open with selected plan |

---

## Scenario 3 — Payment failed / insufficient Stars

| Step | Action | Expected result |
|------|--------|-----------------|
| 3.1 | Open paywall → attempt purchase with insufficient Stars | Payment fails |
| 3.2 | Verify error state | Paywall shows error state: Mascot mood=think; «Что-то пошло не так»; «Попробовать снова» button visible |
| 3.3 | Tap «Попробовать снова» | Returns to `default` plan-selection state; CTA button resets |

---

## Scenario 4 — Dismiss paywall without purchasing

| Step | Action | Expected result |
|------|--------|-----------------|
| 4.1 | Open paywall → tap «Нет, пока нет» | Paywall slides down (220ms ease-in); backdrop fades out |
| 4.2 | Verify state | User is still not Pro; Dashboard unchanged |

---

## Scenario 5 — Purchase via Profile

| Step | Action | Expected result |
|------|--------|-----------------|
| 5.1 | Navigate to Profile → tap «Выбрать тариф» | Paywall opens (same as Scenario 1) |
| 5.2 | Complete purchase | Success toast; on Profile: «★ Pro-подписка активна» with purchase date; «Вернуть платёж» link appears |

---

## Scenario 6 — Refund flow (Pro user)

| Step | Action | Expected result |
|------|--------|-----------------|
| 6.1 | On Profile (Pro user) → tap «Вернуть платёж» | Confirmation tile appears: «Вернуть звёзды?» + «Вернуть» (ruby) and «Отмена» (cream) buttons |
| 6.2 | Tap «Отмена» | Tile dismisses; Pro status unchanged |
| 6.3 | Tap «Вернуть платёж» again → tap «Вернуть» | Loader appears; then «✓ Возврат оформлен»; after 1.2s isPro → false; Pro badge disappears |

---

## Scenario 7 — Already Pro user opens paywall via deep link

| Step | Action | Expected result |
|------|--------|-----------------|
| 7.1 | As Pro user, open `?paywall=1` deep link | Paywall shows Pro status / closes immediately (no duplicate purchase) |

---

## Scenario 8 — Vocabulary limit trigger

| Step | Action | Expected result |
|------|--------|-----------------|
| 8.1 | Add words until vocabulary limit (50 words) | Paywall opens with `trigger=vocabulary_limit` |
| 8.2 | Verify paywall header | Title «Словарь заполнен»; Georgian subtext «ლექსიკონი · 50/50»; first bullet «Словарь без ограничений…» |

---

## Acceptance checklist (sign-off)

- [ ] All 8 scenario groups passed on real device
- [ ] «ვარსკვლავი · звезда» subtext visible on CTA button (below price)
- [ ] Success toast: gold background, auto-dismisses after ~3.5s
- [ ] Refund button appears on Profile immediately after purchase
- [ ] No silent failures — every state transition visible to user
- [ ] Tested on device with 375px screen width

**Tester:** _______________  **Date:** _______________  **Telegram version:** _______________
