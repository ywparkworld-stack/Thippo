import { baseNextConfig, withSentry } from "@thippo/next-config";

export default withSentry(baseNextConfig([{ key: "X-Frame-Options", value: "SAMEORIGIN" }]));
