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
        <receiver android:name=".BootReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
        <receiver android:name=".ReminderReceiver" android:exported="false" />
'''
# home-screen widgets: (class, picker label, provider info)
WIDGETS = [('KharchaWidget', 'Today', 'kharcha_widget_info'), ('BudgetWidget', 'Budget left', 'kw_info_budget'),
           ('WeekWidget', 'Week chart', 'kw_info_week'), ('GoalWidget', 'Goal', 'kw_info_goal'),
           ('QuickWidget', 'Quick add', 'kw_info_quick'), ('QuickBarWidget', 'Quick add bar', 'kw_info_quickbar'),
           ('BillWidget', 'Next bill', 'kw_info_bill'), ('PulseWidget', 'Pulse', 'kw_info_pulse')]
for cls, label, info in WIDGETS:
    comps += '''        <receiver android:name=".%s" android:exported="true" android:label="Kharcha &#183; %s">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/%s" />
        </receiver>
''' % (cls, label, info)
i = s.index('</application>')
s = s[:i] + comps + s[i:]

perm = '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />\n    <uses-permission android:name="android.permission.VIBRATE" />\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />\n    <uses-permission android:name="android.permission.USE_BIOMETRIC" />\n'
i = s.rindex('</manifest>')
s = s[:i] + perm + s[i:]
open(MANIFEST, 'w').write(s)

# Java sources
dest = 'android/app/src/main/java/com/flameblizzard/kharcha'
os.makedirs(dest, exist_ok=True)
for f in glob.glob('native/java/com/flameblizzard/kharcha/*.java'):
    shutil.copy(f, dest)
# widget layout and drawables (native/res mirrors android/app/src/main/res)
for f in glob.glob('native/res/*/*.xml'):
    d = 'android/app/src/main/res/' + os.path.basename(os.path.dirname(f))
    os.makedirs(d, exist_ok=True)
    shutil.copy(f, d)
# black-and-white launcher icons and a plain black splash instead of the Capacitor defaults
res = 'android/app/src/main/res'
shutil.rmtree(res + '/mipmap-anydpi-v26', ignore_errors=True)
for d in glob.glob('native/icons/mipmap-*'):
    for f in glob.glob(d + '/*.png') + glob.glob(d + '/*.xml'):  # PNGs + adaptive icon (QT Suite icon family)
        os.makedirs(res + '/' + os.path.basename(d), exist_ok=True)
        shutil.copy(f, res + '/' + os.path.basename(d) + '/' + os.path.basename(f))
for f in glob.glob(res + '/drawable*/splash.png'):
    shutil.copy('native/icons/splash.png', f)
# version from git: versionCode = number of commits (always grows), versionName = 1.<count> (<short hash>)
try:
    import re, subprocess
    n = subprocess.check_output(['git', 'rev-list', '--count', 'HEAD'], text=True).strip()
    h = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], text=True).strip()
    g = 'android/app/build.gradle'
    t = open(g).read()
    t = re.sub(r'versionCode \d+', 'versionCode ' + n, t)
    t = re.sub(r'versionName "[^"]*"', 'versionName "1.%s (%s)"' % (n, h), t)
    open(g, 'w').write(t)
    print('version 1.%s (%s)' % (n, h))
except Exception as e:
    print('version left as is:', e)
print('android project patched')
