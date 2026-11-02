"""Run after `npx cap add android`: wires the native notification features into the generated project."""
import shutil, glob, os

MANIFEST = 'android/app/src/main/AndroidManifest.xml'
s = open(MANIFEST).read()

# kharcha://add?... deep link on the main activity
link = '''
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="kharcha" />
        </intent-filter>
'''
i = s.index('</activity>')
s = s[:i] + link + s[i:]

# screen reader for UPI apps, and the quick-settings tile
comps0 = '''
        <service
            android:name=".PayWatcher"
            android:exported="true"
            android:label="Kharcha payment detector"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data android:name="android.accessibilityservice" android:resource="@xml/kharcha_accessibility" />
        </service>
        <service
            android:name=".AddTile"
            android:exported="true"
            android:label="Add expense"
            android:icon="@android:drawable/ic_menu_add"
            android:permission="android.permission.BIND_QUICK_SETTINGS_TILE">
            <intent-filter>
                <action android:name="android.service.quicksettings.action.QS_TILE" />
            </intent-filter>
        </service>
'''
i = s.index('</application>')
s = s[:i] + comps0 + s[i:]

# notification listener + button receiver
comps = '''
        <service
            android:name=".TxListener"
            android:exported="true"
            android:label="Kharcha"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
        <receiver android:name=".ActionReceiver" android:exported="false" />
'''
i = s.index('</application>')
s = s[:i] + comps + s[i:]

perm = '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n'
i = s.rindex('</manifest>')
s = s[:i] + perm + s[i:]
open(MANIFEST, 'w').write(s)

# Java sources
dest = 'android/app/src/main/java/com/flameblizzard/kharcha'
os.makedirs(dest, exist_ok=True)
for f in glob.glob('native/java/com/flameblizzard/kharcha/*.java'):
    shutil.copy(f, dest)
# accessibility config (limited to UPI apps) and its description
xmldir = 'android/app/src/main/res/xml'
os.makedirs(xmldir, exist_ok=True)
open(xmldir + '/kharcha_accessibility.xml', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault"
    android:canRetrieveWindowContent="true"
    android:notificationTimeout="300"
    android:description="@string/kharcha_a11y_desc"
    android:packageNames="in.org.npci.upiapp,com.google.android.apps.nbu.paisa.user,com.phonepe.app,net.one97.paytm,com.dreamplug.androidapp,com.amazon.mShop.android.shopping" />
''')
sp = 'android/app/src/main/res/values/strings.xml'
t = open(sp).read()
t = t.replace('</resources>', '    <string name="kharcha_a11y_desc">Looks for the "payment successful" screen in BHIM, GPay, PhonePe and Paytm so Kharcha can pop up and ask what you spent on. Reads text on those apps only. Nothing is stored or sent anywhere.</string>\n</resources>')
open(sp, 'w').write(t)
print('android project patched')
