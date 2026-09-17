# ExpensePulse AI — Expo Project (by ZeeU Creative Studio)

## Setup
```bash
npm install
npx expo prebuild
```

## Local Android APK build (uses credentials.json keystore)
1. Place your real ZeeU production keystore file at the project root, named exactly `zeeu-keystore.jks`.
2. Edit `credentials.json` — replace the two password placeholders with your real values (keystore alias is already set to `zeeu`).
3. Run:
```bash
eas build --profile production-apk-local --platform android --local
```

## Assets
See `assets/README.md` — drop in `icon.png`, `splash.png`, and `banner.png` before building.

## Package / Branding
- Package name: com.zeeucreativestudio.expensepulseai
- Studio: ZeeU Creative Studio
- Official Vault: https://zeeu-creative-studio-e-book-vault.ai.studio

## Important
`react-native-google-mobile-ads` contains native code — this project CANNOT run inside
the plain "Expo Go" app. Use `npx expo run:android` or an EAS development build.
