import { useState } from "react";
import { Spinner } from "@inkjs/ui";
import type { ModelInfo } from "@lmstudio/sdk";
import { AsyncView, Row, Text, SearchableSelect } from "@/components/index.js";
import { setView, Menu } from "@/router/index.js";
import * as models from "@/models/index.js";

export const SelectModel = () => {
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const handleInput = (_: string, { escape }: { escape: boolean }) => {
    if (escape) setView(Menu);
  };

  async function handleOnChange(model: string) {
    setLoading(true);
    setLoadingProgress(0);

    await models.selectModel(model, (progress: number) => {
      const percent = Math.round(progress * 100);
      setLoadingProgress(percent);
    });

    setView(Menu);
  }

  if (loading)
    return (
      <>
        <Row>
          <Spinner type="dots" />
          <Text>&nbsp;{loadingProgress}%</Text>
        </Row>
      </>
    );

  return (
    <AsyncView<ModelInfo[]>
      title="Select Model"
      fetcher={models.listDownloaded}
      onInput={handleInput}
    >
      {models => {
        return (
          <SearchableSelect
            options={models.map(model => ({
              label: model.modelKey,
              value: model.modelKey
            }))}
            onChange={handleOnChange}
            placeholder="filter by name"
            maxItems={15}
          />
        );
      }}
    </AsyncView>
  );
};
