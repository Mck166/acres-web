const IOS_BUNDLE_ID = "com.myacresapp.acres";
const ANDROID_PACKAGE =
  process.env.ANDROID_PACKAGE_NAME?.trim() || "com.anonymous.AcresApp";

export function getAppleAppSiteAssociation() {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  if (!teamId) return null;

  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${IOS_BUNDLE_ID}`],
          components: [
            {
              "/": "/properties/*",
              comment: "Opens a property listing in the Acres app",
            },
          ],
        },
      ],
    },
  };
}

export function getAssetLinks() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (fingerprints.length === 0) return null;

  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export function wellKnownHeaders() {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600",
  };
}
