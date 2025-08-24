import { useAsyncData } from "@/hooks";
import { Spinner } from "@/components/index.js";
import { View } from "./View";

interface AsyncViewProps<T> {
  title: string;
  fetcher: () => Promise<T>;
  onInput?: (input: string, key: any) => void;
  children: (data: T) => React.ReactNode;
}

export function AsyncView<T>({
  title,
  fetcher,
  onInput,
  children
}: AsyncViewProps<T>) {
  const { data, loading, error } = useAsyncData(fetcher);

  if (loading) return <Spinner />;

  // Throw errors to let ViewErrorBoundary handle them with retry
  if (error) throw new Error(error);
  if (!data) throw new Error("No data received");

  return (
    <View
      title={title}
      onInput={onInput}
    >
      {children(data)}
    </View>
  );
}
