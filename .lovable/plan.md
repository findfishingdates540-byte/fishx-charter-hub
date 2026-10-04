# Fish-X mobile apps (iOS + Android) and one-screen welcome page

## What you get
1. A new one-screen welcome page, matching your reference: a full-width fishing photo carousel with dots, the Fish-X badge, the headline "Fish. Connect. Explore.", a short subline, a "Sign Up Free" button, a "Log In" button, "Or continue with" Google / Apple / Facebook buttons, and Terms / Privacy links. It fits one phone screen with no scrolling.
2. In the phone apps this welcome page opens first. Signed-in users skip it and land on their own dashboard, the same way the website already works.
3. The website keeps its current homepage. Visitors on a phone browser can also open the welcome page at `/welcome`.
4. The whole app wrapped as a real iOS app and Android app, using the app you already have, so every feature (bookings, shop, messages, payments) works inside them.

## Things only you can do (needed before the stores accept the apps)
- **Apple Developer account** ($99/year) and **Google Play Developer account** ($25 one-time).
- **A Mac with Xcode** to build the iOS app. Android can be built on Windows or Mac with Android Studio.
- **Export the project to GitHub** (top-right GitHub button), then on your computer: download it, install, add the phone platforms, build, and open in Xcode / Android Studio. I will give you exact step-by-step commands.
- **Store listings**: app name, description, screenshots, privacy policy link, and support email.
- **Social sign-in**: Google sign-in works out of the box. Apple sign-in is required by Apple if you offer Google or Facebook in the iPhone app. Facebook needs your own Facebook developer app keys.

## Other things to do inside the app
- App icon and splash screen made from your Book Fishing Trips logo.
- A Terms page and a Privacy Policy page (both stores require them). I will write draft text that you should review, since I am making it up.
- Account deletion option in My Account (both stores require it).
- Payments: Stripe checkout opens in a secure in-app browser. Real trips and physical products are allowed this way, so no Apple/Google in-app purchase is needed.
- Optional later: push notifications for new bookings and messages, and photo uploads from the camera.

## Photos
I will make 3 or 4 fishing carousel photos, or you can upload your own (the reference photo can be used if you own the rights).

## Technical details
- Capacitor (`@capacitor/core`, `cli`, `ios`, `android`); `capacitor.config.ts` with appId `com.bookfishingtrips.app`, and `server.url` pointing to the published site, so the native shell loads the live app (SSR and server functions stay hosted).
- New route `src/routes/welcome.tsx` with its own head metadata. A native-platform check (`Capacitor.isNativePlatform()`) on `/` redirects to `/welcome` when there is no session; existing role routing stays the same after sign-in.
- OAuth: Google uses the managed provider; Apple needs to be enabled; Facebook needs a client ID and secret. Deep-link redirect back into the app is handled with `@capacitor/app` and `@capacitor/browser`.
- Account deletion: a server function using the admin client, scoped to the caller's own user ID.
- Routes for Terms and Privacy: `/terms` and `/privacy`.
