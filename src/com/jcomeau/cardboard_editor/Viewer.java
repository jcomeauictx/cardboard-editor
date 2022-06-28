package com.jcomeau.cardboard_editor;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class Viewer extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.viewer);
        TextView text = (TextView)findViewById(R.id.splash);
        text.setText("Cardboard editor viewer");
    }
}
