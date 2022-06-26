package com.jcomeau.android-editor;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class Keyboard extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        TextView text = (TextView)findViewById(R.id.splash);
        text.setText("Cardboard editor keyboard");
    }
}
