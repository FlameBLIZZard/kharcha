package com.flameblizzard.kharcha;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.app.NotificationManagerCompat;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/**
 * The floating "what was that for?" card that appears on top of whatever app you are in.
 * Uses "Display over other apps" if granted, otherwise the accessibility screen reader's overlay window.
 */
final class Overlay {
    private static final Handler H = new Handler(Looper.getMainLooper());
    private static View current;
    private static WindowManager currentWm;

    static boolean canShow(Context app) {
        return (Build.VERSION.SDK_INT >= 23 && Settings.canDrawOverlays(app)) || PayWatcher.instance != null;
    }

    /** Returns true if an overlay will be shown (so the notification can stay quiet). */
    static boolean show(final Context app, final int nid, final String amtStr, final String merchant, final String guess) {
        final Context wctx;
        final int type;
        if (Build.VERSION.SDK_INT >= 23 && Settings.canDrawOverlays(app)) {
            wctx = app;
            type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        } else if (PayWatcher.instance != null && Build.VERSION.SDK_INT >= 22) {
            wctx = PayWatcher.instance;
            type = WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY;
        } else {
            return false;
        }
        H.post(new Runnable() {
            @Override public void run() {
                try { build(wctx, app, type, nid, amtStr, merchant, guess); } catch (Exception ignored) { }
            }
        });
        return true;
    }

    static void dismiss() {
        try { if (current != null && currentWm != null) currentWm.removeView(current); } catch (Exception ignored) { }
        current = null;
        currentWm = null;
    }

    private static int dp(Context c, int v) { return (int) (v * c.getResources().getDisplayMetrics().density + 0.5f); }

    private static GradientDrawable box(int color, int radius, int stroke) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(radius);
        if (stroke != 0) g.setStroke(2, stroke);
        return g;
    }

    private static void build(final Context wctx, final Context app, int type, final int nid, final String amtStr,
                              final String merchant, String guess) {
        dismiss();
        final WindowManager wm = (WindowManager) wctx.getSystemService(Context.WINDOW_SERVICE);
        final List<String[]> cats = Store.cats(app);
        final String[] sel = { cats.get(0)[0] };
        for (String[] x : cats) if (x[0].equals(guess)) sel[0] = guess;

        final FrameLayout root = new FrameLayout(wctx);
        root.setPadding(dp(wctx, 10), dp(wctx, 10), dp(wctx, 10), dp(wctx, 10));
        LinearLayout card = new LinearLayout(wctx);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(wctx, 16), dp(wctx, 14), dp(wctx, 16), dp(wctx, 14));
        card.setBackground(box(Color.parseColor("#0A0A0A"), dp(wctx, 22), Color.parseColor("#262626")));
        root.addView(card, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(wctx);
        title.setText("₹" + amtStr + (merchant.isEmpty() ? "" : "  ·  " + merchant));
        title.setTextColor(Color.WHITE);
        title.setTextSize(22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(title);
        TextView sub = new TextView(wctx);
        sub.setText("What was it for?");
        sub.setTextColor(Color.parseColor("#8A8A8A"));
        sub.setTextSize(13);
        card.addView(sub);

        HorizontalScrollView sv = new HorizontalScrollView(wctx);
        sv.setHorizontalScrollBarEnabled(false);
        LinearLayout row = new LinearLayout(wctx);
        row.setOrientation(LinearLayout.HORIZONTAL);
        sv.addView(row);
        LinearLayout.LayoutParams svp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        svp.topMargin = dp(wctx, 10);
        card.addView(sv, svp);
        final List<TextView> chips = new ArrayList<>();
        final Runnable paint = new Runnable() {
            @Override public void run() {
                for (int i = 0; i < chips.size(); i++) {
                    boolean on = cats.get(i)[0].equals(sel[0]);
                    chips.get(i).setBackground(box(Color.parseColor(on ? "#FFFFFF" : "#1A1A1A"), dp(wctx, 16), 0));
                    chips.get(i).setTextColor(Color.parseColor(on ? "#000000" : "#FFFFFF"));
                }
            }
        };
        for (int i = 0; i < cats.size(); i++) {
            final String id = cats.get(i)[0];
            TextView t = new TextView(wctx);
            t.setText(cats.get(i)[1]);
            t.setTextSize(14);
            t.setTypeface(Typeface.DEFAULT_BOLD);
            t.setPadding(dp(wctx, 14), dp(wctx, 9), dp(wctx, 14), dp(wctx, 9));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.rightMargin = dp(wctx, 8);
            t.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { sel[0] = id; paint.run(); }
            });
            row.addView(t, lp);
            chips.add(t);
        }
        paint.run();

        final EditText note = new EditText(wctx);
        note.setHint("Add a note (optional)");
        note.setHintTextColor(Color.parseColor("#8A8A8A"));
        note.setTextColor(Color.WHITE);
        note.setTextSize(15);
        note.setSingleLine(true);
        note.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        note.setPadding(dp(wctx, 14), dp(wctx, 10), dp(wctx, 14), dp(wctx, 10));
        note.setBackground(box(Color.parseColor("#1A1A1A"), dp(wctx, 14), 0));
        LinearLayout.LayoutParams np = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        np.topMargin = dp(wctx, 10);
        card.addView(note, np);

        LinearLayout buttons = new LinearLayout(wctx);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bp.topMargin = dp(wctx, 12);
        card.addView(buttons, bp);

        TextView skip = new TextView(wctx);
        skip.setText("Not mine");
        skip.setTextColor(Color.parseColor("#8A8A8A"));
        skip.setTextSize(14);
        skip.setPadding(dp(wctx, 6), dp(wctx, 10), dp(wctx, 14), dp(wctx, 10));
        buttons.addView(skip);
        TextView full = new TextView(wctx);
        full.setText("Open app ›");
        full.setTextColor(Color.parseColor("#BDBDBD"));
        full.setTextSize(14);
        full.setPadding(dp(wctx, 6), dp(wctx, 10), dp(wctx, 6), dp(wctx, 10));
        buttons.addView(full);
        View spacer = new View(wctx);
        buttons.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));
        TextView save = new TextView(wctx);
        save.setText("Save");
        save.setTextColor(Color.parseColor("#000000"));
        save.setTextSize(16);
        save.setTypeface(Typeface.DEFAULT_BOLD);
        save.setGravity(Gravity.CENTER);
        save.setPadding(dp(wctx, 34), dp(wctx, 11), dp(wctx, 34), dp(wctx, 11));
        save.setBackground(box(Color.parseColor("#FFFFFF"), dp(wctx, 16), 0));
        buttons.addView(save);

        final WindowManager.LayoutParams p = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        p.gravity = Gravity.BOTTOM;
        p.y = dp(wctx, 8);
        p.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;

        // Tapping the note box makes the window focusable so the keyboard can appear.
        note.setOnTouchListener(new View.OnTouchListener() {
            @Override public boolean onTouch(View v, MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_DOWN && (p.flags & WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE) != 0) {
                    p.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
                    try { wm.updateViewLayout(root, p); } catch (Exception ignored) { }
                    note.post(new Runnable() {
                        @Override public void run() {
                            note.requestFocus();
                            InputMethodManager imm = (InputMethodManager) wctx.getSystemService(Context.INPUT_METHOD_SERVICE);
                            if (imm != null) imm.showSoftInput(note, 0);
                        }
                    });
                }
                return false;
            }
        });

        save.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                try {
                    String typed = note.getText().toString().trim();
                    String text = typed.isEmpty() ? merchant : (merchant.isEmpty() ? typed : merchant + " – " + typed);
                    JSONObject o = new JSONObject();
                    o.put("id", "o" + System.currentTimeMillis());
                    o.put("amt", Double.parseDouble(amtStr));
                    o.put("cat", sel[0]);
                    o.put("note", text);
                    o.put("ts", System.currentTimeMillis());
                    Store.add(app, o);
                    Toast.makeText(app, "Saved ₹" + amtStr + " · " + Notifier.label(app, sel[0]), Toast.LENGTH_SHORT).show();
                } catch (Exception ignored) { }
                NotificationManagerCompat.from(app).cancel(nid);
                dismiss();
            }
        });
        skip.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { NotificationManagerCompat.from(app).cancel(nid); dismiss(); }
        });
        full.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                try {
                    String uri = "kharcha://add?amount=" + amtStr + "&merchant=" + URLEncoder.encode(merchant, "UTF-8") + "&cat=" + sel[0];
                    Intent open = new Intent(app, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse(uri))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    app.startActivity(open);
                } catch (Exception ignored) { }
                NotificationManagerCompat.from(app).cancel(nid);
                dismiss();
            }
        });

        wm.addView(root, p);
        current = root;
        currentWm = wm;
        final View mine = root;
        H.postDelayed(new Runnable() {
            @Override public void run() { if (current == mine) dismiss(); }
        }, 45000);
    }
}
