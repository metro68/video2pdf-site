import { OpenRedirect } from "./OpenRedirect";

// Universal-link target: when the app is installed, iOS/Android open it directly
// with this URL (the app reads ?token=). This page only renders when the app did
// NOT intercept (not installed), so it forwards to the OneLink store link with
// the redeem params for deferred deep linking after install.
export default function OpenPage() {
  return <OpenRedirect />;
}
