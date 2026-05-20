# ProjectProof Play Store Release

## Current App ID

```txt
com.craigsdevelopments.projectproof
```

## Build A Signed AAB

The release build reads signing values from environment variables:

```sh
export PLAY_KEYSTORE_PATH="$PWD/.play-signing/projectproof-upload-keystore.jks"
export PLAY_KEYSTORE_PASSWORD="your-keystore-password"
export PLAY_KEY_ALIAS="projectproof-upload"
export PLAY_KEY_PASSWORD="your-key-password"
export PLAY_VERSION_CODE=3
export PLAY_VERSION_NAME=1.4
npm run build:playstore-aab
```

The output file is:

```txt
android/app/build/outputs/bundle/release/app-release.aab
```

Upload that `.aab` to Google Play Console closed testing.

## Important

Do not commit `.play-signing`, passwords, `.jks`, `.apk`, or `.aab` files.
