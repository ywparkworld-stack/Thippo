import { baseNextConfig } from "@thippo/next-config";

export default baseNextConfig([{ key: "X-Frame-Options", value: "SAMEORIGIN" }]);
