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
        <intent-filter>
            <action android:name="android.intent.action.SEND" />
            <category android:name="android.intent.category.DEFAULT" />
            <data android:mimeType="text/plain" />
        </intent-filter>
'''
i = s.index('</activity>')
s = s[:i] + link + s[i:]

# the quick-settings tile
comps0 = '''
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

perm = '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />\n'
i = s.rindex('</manifest>')
s = s[:i] + perm + s[i:]
open(MANIFEST, 'w').write(s)

# Java sources
dest = 'android/app/src/main/java/com/flameblizzard/kharcha'
os.makedirs(dest, exist_ok=True)
for f in glob.glob('native/java/com/flameblizzard/kharcha/*.java'):
    shutil.copy(f, dest)
# black-and-white launcher icons and a plain black splash instead of the Capacitor defaults
res = 'android/app/src/main/res'
shutil.rmtree(res + '/mipmap-anydpi-v26', ignore_errors=True)
for d in glob.glob('native/icons/mipmap-*'):
    for f in glob.glob(d + '/*.png'):
        os.makedirs(res + '/' + os.path.basename(d), exist_ok=True)
        shutil.copy(f, res + '/' + os.path.basename(d) + '/' + os.path.basename(f))
for f in glob.glob(res + '/drawable*/splash.png'):
    shutil.copy('native/icons/splash.png', f)
print('android project patched')
