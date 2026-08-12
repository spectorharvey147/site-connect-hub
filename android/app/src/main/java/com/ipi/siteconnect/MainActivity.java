package com.ipi.siteconnect;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(DeviceSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
