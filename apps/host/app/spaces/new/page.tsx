import { Card } from "@thippo/ui";
import { createSpaceAction } from "../../actions/spaces";
import { requireHost } from "../../lib/host";
import { minPriceTable } from "../_components/min-prices";
import { SpaceForm } from "../_components/space-form";

export default async function NewSpacePage() {
  await requireHost("/spaces/new");
  return (
    <Card className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">スペースの登録</h1>
      <p className="text-sm text-zinc-600">
        登録したスペースは非公開の状態で作られます。写真と営業時間を設定してから公開してください。
      </p>
      <SpaceForm
        action={createSpaceAction}
        minPrices={minPriceTable()}
        submitLabel="登録する"
        initial={{
          name: "",
          description: "",
          address: "",
          area: "",
          capacity: "",
          amenities: [],
          pricePer30min: "",
          minSlots: 1,
        }}
      />
    </Card>
  );
}
