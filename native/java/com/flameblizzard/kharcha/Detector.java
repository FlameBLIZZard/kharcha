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
        {"food", "zomato|swiggy|domino|pizza|mcdonald|kfc|burger|cafe|coffee|starbucks|chai|restaurant|hotel|dhaba|bakery|eats|food|biryani|subway|haldiram"},
        {"groceries", "blinkit|zepto|instamart|bigbasket|dmart|grocer|kirana|mart|reliance fresh|jiomart|milk|dairy|vegetable|fruit"},
        {"travel", "uber|ola|rapido|irctc|railway|metro|petrol|fuel|hpcl|bpcl|indian oil|shell|fastag|redbus|makemytrip|goibibo|indigo|cab|parking"},
        {"shopping", "amazon|flipkart|myntra|ajio|meesho|nykaa|decathlon|croma|store|shop|mall|fashion|lifestyle"},
        {"bills", "airtel|jio|vodafone|bsnl|electric|bescom|msedcl|tata power|recharge|broadband|wifi|gas|rent|emi|insurance|lic"},
        {"fun", "netflix|spotify|prime|hotstar|bookmyshow|pvr|inox|steam|playstation|game|movie|youtube|disney"},
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
}
