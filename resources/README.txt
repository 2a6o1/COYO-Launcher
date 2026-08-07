ALTERNATIVE APPROACH FOR OFFLINE MODE

Instead of using authlib-injector.jar (which has broken download links),
this launcher uses Minecraft's native --offline mode.

To enable offline mode without authlib-injector:
1. Launch Minecraft with --offline --accessToken offline --uuid offline --userType legacy

These arguments are passed directly to the Java process.
