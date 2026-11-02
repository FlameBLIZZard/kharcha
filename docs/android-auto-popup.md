# Auto-popup on Android

Goal: every time Google Pay, PhonePe, Paytm, or your bank tells you money left your account, Kharcha opens with the amount filled in.

1. **Install Kharcha** from Chrome: ⋮ → Install app. (Links to the installed app then open in the app, not a browser tab.)
2. **Install MacroDroid** (free) from the Play Store. Grant *Notification access* when asked. On Xiaomi / Oppo / Vivo / Realme also allow *Autostart* and set battery to *No restrictions*, or the trigger gets killed.
3. **Add macro**
   - **Trigger**: Device Events → Notification → *Notification Received*.
     - Applications: select Google Pay, PhonePe, Paytm, your bank app, and *Messages* (for bank SMS).
     - Text content: *Contains* — `debited|paid|sent|spent` (tick *Regex* or add them as "any of").
   - **Action**: Applications → *Open Website / HTTP GET* → *Open website*.
     - URL: `<your Kharcha URL>/#add?text=` then insert magic text `{notification}` at the end (the "…" button).
   - **Constraint (optional)**: none needed.
4. Save the macro. Test it by pasting a bank SMS into Setup → *Test it* in Kharcha, or by making a ₹1 UPI payment.

If both an SMS and an app notification arrive for one payment, Kharcha warns you that the same amount was just logged.

## Without MacroDroid

- Long-press a bank SMS → Share → Kharcha.
- Long-press the Kharcha icon → *Add expense*.

## Daily reminder (optional)

MacroDroid: Trigger *Day/Time* 9:30 PM → Action *Open website* `<your Kharcha URL>/` so you can check today's number and log any cash spends.
