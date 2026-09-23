package com.personalcost.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PersonalCostPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
