import { analyzeToGraph, getCodeFiles, RustKuzuIngestor } from "@sage/analysis";
const files = ["src/components/chat/Chat.tsx"];
const analysisData = analyzeToGraph(files);
const ingestor = new RustKuzuIngestor(".sage/code.kuzu");
ingestor.initialize().then(async () => {
  const result = await ingestor.ingestStream(analysisData);
  console.log("Done:", result);
});
