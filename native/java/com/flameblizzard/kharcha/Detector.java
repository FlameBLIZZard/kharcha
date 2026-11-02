package com.flameblizzard.kharcha;

import android.content.Context;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reads a payment notification or SMS: amount, merchant, category guess. Mirrors parse.js. */
final class Detector {
    private static final Pattern AMT = Pattern.compile("(?i)(?:rs\\.?|inr|₹|rupees)\\s*:?\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)");
    private static final Pattern AMT_AFTER = Pattern.compile("(?i)([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*(?:rs\\.?|inr|₹|rupees)\\b");
    private static final Pattern DEBIT = Pattern.compile("(?i)\\b(debited|spent|paid|sent|withdrawn|purchase|payment of|txn of|transferred)\\b");
    private static final Pattern CREDIT = Pattern.compile("(?i)\\b(credited|received|refund|cashback|deposited)\\b");
    private static final Pattern NOISE = Pattern.compile("(?i)\\b(otp|one time password|verification code|do not share|requested|request money|collect request|will be debited|failed|declined|unsuccessful)\\b");
    private static final String STOP = "(?=\\s+(?:on|via|using|from|ref|upi|txn|avl|bal|is|has|successful|success|done|completed)\\b|[.,\\n]|$)";
    private static final Pattern[] MERCHANT = {
        Pattern.compile("(?i)\\bpaid\\s+(?:rs\\.?|inr|₹)?\\s*[0-9,.]*\\s*to\\s+([^\\n.,]+?)" + STOP),
        Pattern.compile("(?i)\\b(?:to|towards)\\s+(?:vpa\\s+|a/c\\s+)?([^\\n.,]+?)" + STOP),
        Pattern.compile("(?i)\\b(?:at|@)\\s+([^\\n.,]+?)" + STOP),
        Pattern.compile("(?i)\\binfo[:\\s]+(?:upi/)?([^\\n.,]+)"),
    };
    private static final String[][] CATS = {
        {"subscriptions", "netflix|spotify|prime video|amazon prime|hotstar|disney|youtube|google one|google play|icloud|apple\\.com|apple media|itunes|chatgpt|openai|anthropic|claude|canva|adobe|notion|github|microsoft|office 365|dropbox|zee5|sonyliv|jiocinema|audible|linkedin|duolingo|subscription|autopay|mandate|renewal|playstation|xbox|steam"},
        {"petrol", "petrol|diesel|fuel|hpcl|bpcl|iocl|indian oil|indianoil|bharat petroleum|hindustan petroleum|shell|nayara|reliance bp|jio-bp|essar|fastag|pump"},
        {"food", "zomato|swiggy|domino|pizza|mcdonald|kfc|burger|cafe|coffee|starbucks|chai|restaurant|hotel|dhaba|bakery|eats|food|biryani|subway|haldiram|barbeque|dineout|eatsure|magicpin"},
        {"groceries", "blinkit|zepto|instamart|bigbasket|dmart|grocer|kirana|mart|reliance fresh|jiomart|milk|dairy|vegetable|fruit"},
        {"shopping", "amazon|flipkart|myntra|ajio|meesho|nykaa|decathlon|croma|store|shop|mall|fashion|lifestyle|reliance digital|tata cliq|snapdeal"},
        {"travel", "uber|ola|rapido|irctc|railway|metro|redbus|makemytrip|goibibo|indigo|air india|cab|auto|parking|yatra|ixigo"},
        {"bills", "airtel|jio|vodafone|bsnl|electric|bescom|msedcl|tata power|recharge|broadband|wifi|gas|water|rent|emi|insurance|lic"},
        {"fun", "bookmyshow|pvr|inox|game|movie"},
        {"health", "pharm|medic|apollo|1mg|netmeds|hospital|clinic|doctor|lab|gym|cult"},
    };

    static String guess(String s) {
        for (String[] c : CATS) if (Pattern.compile("(?i)" + c[1]).matcher(s).find()) return c[0];
        return "";
    }

    static String merchant(String text) {
        for (Pattern p : MERCHANT) {
            Matcher m = p.matcher(text);
            if (!m.find()) continue;
            String n = m.group(1).replaceAll("\\s+", " ").trim();
            if (n.contains("@")) n = n.split("@")[0].split("[._-]")[0];
            n = n.replaceAll("(?i)^(mr|ms|mrs|m/s)\\.?\\s+", "").trim();
            if (n.length() > 32) n = n.substring(0, 32).trim();
            if (n.isEmpty() || n.matches("(?i)[x*\\d\\s]+") || n.matches("(?i)^(your|a/c|account|ac|you)\\b.*")) continue;
            StringBuilder b = new StringBuilder();
            for (String w : n.split(" ")) if (!w.isEmpty()) b.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1).toLowerCase()).append(' ');
            return b.toString().trim();
        }
        return "";
    }

    /** Returns true if it looked like an expense and a Kharcha notification was shown. */
    static boolean handle(Context c, String text, boolean force) {
        if (text == null) return false;
        text = text.replace(' ', ' ');
        if (NOISE.matcher(text).find()) return false;
        boolean debit = DEBIT.matcher(text).find();
        if (!debit) return false;
        if (CREDIT.matcher(text).find() && !Pattern.compile("(?i)\\bdebited\\b").matcher(text).find()) return false;
        Matcher m = AMT.matcher(text);
        if (!m.find()) { m = AMT_AFTER.matcher(text); if (!m.find()) return false; }
        double amt;
        try { amt = Double.parseDouble(m.group(1).replace(",", "")); } catch (Exception e) { return false; }
        if (amt <= 0) return false;
        if (!force && Store.isDuplicate(c, amt)) return false;
        String merch = merchant(text);
        Notifier.show(c, amt, merch, guess(merch + " " + text));
        return true;
    }

    // ---- Reading a UPI app's "payment successful" screen (AccessibilityService) ----
    private static final Pattern SCREEN_OK = Pattern.compile("(?i)\\b(payment\\s+successful|paid\\s+successfully|payment\\s+done|payment\\s+completed|money\\s+sent|sent\\s+successfully|transaction\\s+successful|successfully\\s+(?:paid|sent|transferred)|transfer\\s+successful|paid\\s+to)\\b");
    private static final Pattern SCREEN_BAD = Pattern.compile("(?i)\\b(failed|declined|pending|processing|enter\\s+(?:upi\\s+)?pin|request(?:ed)?\\s+(?:from|money)|received\\s+from|credited)\\b");
    private static final Pattern SCREEN_AMT = Pattern.compile("(?i)(?:\u20b9|rs\\.?|inr)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)");
    private static final Pattern TO_LABEL = Pattern.compile("(?i)^(paid to|sent to|to|paying to|transferred to|payment to)\\s*:?$");
    private static final Pattern TO_INLINE = Pattern.compile("(?i)^(?:paid|sent|payment|transferred)\\s+(?:successfully\\s+)?to\\s+(.+)$");

    /** Takes all text on a UPI app screen. Returns true if it was a successful payment and a popup was shown. */
    static boolean handleScreen(Context c, java.util.List<String> nodes) {
        if (nodes == null || nodes.isEmpty()) return false;
        StringBuilder all = new StringBuilder();
        for (String n : nodes) all.append(n).append('\n');
        String joined = all.toString();
        if (!SCREEN_OK.matcher(joined).find()) return false;
        Store.setLastScreen(c, joined.replace("\n", " | "));
        if (SCREEN_BAD.matcher(joined).find()) return false;
        double amt = 0;
        for (String n : nodes) {
            Matcher m = SCREEN_AMT.matcher(n);
            if (m.find()) { try { amt = Double.parseDouble(m.group(1).replace(",", "")); } catch (Exception e) { amt = 0; } if (amt > 0) break; }
        }
        if (amt <= 0) return false;
        String name = "", vpa = "";
        for (int i = 0; i < nodes.size() && name.isEmpty(); i++) {
            String n = nodes.get(i).trim();
            Matcher in = TO_INLINE.matcher(n);
            if (in.find()) name = pretty(in.group(1));
            else if (TO_LABEL.matcher(n).find() && i + 1 < nodes.size()) {
                String nx = nodes.get(i + 1).trim();
                if (nx.contains("@")) vpa = nx; else name = pretty(nx);
            }
        }
        if (name.isEmpty()) for (String n : nodes) if (n.matches("(?i)^[a-z0-9._-]{2,}@[a-z]{2,}$")) { vpa = n; break; }
        if (name.isEmpty() && !vpa.isEmpty()) name = pretty(vpa.split("@")[0].split("[._-]")[0]);
        if (Store.isDuplicate(c, amt)) return false;
        Notifier.show(c, amt, name, guess(name + " " + joined));
        return true;
    }

    private static String pretty(String raw) {
        String n = raw == null ? "" : raw.replaceAll("\\s+", " ").trim();
        if (n.length() > 32) n = n.substring(0, 32).trim();
        if (n.isEmpty() || n.matches("(?i)[x*\\d\\s]+") || n.contains("\u20b9")) return "";
        StringBuilder b = new StringBuilder();
        for (String w : n.split(" ")) if (!w.isEmpty()) b.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1).toLowerCase()).append(' ');
        return b.toString().trim();
    }
}
