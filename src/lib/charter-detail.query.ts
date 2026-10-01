import { queryOptions } from "@tanstack/react-query";
import { getCharterPackages } from "@/lib/charters.functions";

export const charterDetailQO = (charterId: string) =>
  queryOptions({
    queryKey: ["charter-detail", charterId],
    queryFn: () => getCharterPackages({ data: { charterId } }),
  });
