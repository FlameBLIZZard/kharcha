package com.flameblizzard.kharcha;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KharchaNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
