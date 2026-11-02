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
print('android project patched')
