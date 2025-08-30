import { qwenAuth } from "../auth/QwenDeviceAuth.js";
import { AsyncView, SearchableSelect } from "../components";
import { Menu, setView } from "../router";
import { success, error, info, warning } from "../utils/colors.js";

interface Provider {
  id: string;
  name: string;
  description: string;
  status: "available" | "configured" | "error";
}

// Simple provider list - just for display for now
async function listProviders(): Promise<Provider[]> {
  // Check Qwen OAuth status
  let qwenStatus: "available" | "configured" | "error" = "available";
  try {
    // Try to get a token to check if authenticated
    const token = await qwenAuth.getAccessToken();
    qwenStatus = token ? "configured" : "available";
  } catch (error) {
    qwenStatus = "error";
  }

  return [
    {
      id: "lmstudio",
      name: "LM Studio",
      description: "Local model inference via LM Studio",
      status: "available"
    },
    {
      id: "qwen-oauth",
      name: "Qwen (OAuth)",
      description: "Easy browser-based authentication (same as qwen-code)",
      status: qwenStatus
    }
    // {
    //   id: "qwen-dashscope",
    //   name: "Qwen (DashScope)",
    //   description: "Qwen models via Alibaba Cloud DashScope",
    //   status:
    //     process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY
    //       ? "configured"
    //       : "available"
    // },
    // {
    //   id: "qwen-modelscope",
    //   name: "Qwen (ModelScope)",
    //   description: "Free tier: 2,000 calls/day via ModelScope",
    //   status:
    //     process.env.MODELSCOPE_API_KEY || process.env.OPENAI_API_KEY
    //       ? "configured"
    //       : "available"
    // },
    // {
    //   id: "openai",
    //   name: "OpenAI",
    //   description: "GPT-4, GPT-3.5, and other OpenAI models",
    //   status: process.env.OPENAI_API_KEY ? "configured" : "available"
    // }
  ];
}

export const SelectProvider = () => {
  const handleInput = (input: string, { escape }: { escape: boolean }) => {
    if (escape) {
      // Cancel any ongoing authentication
      qwenAuth.cancelAuth();
      setView(Menu);
    }
  };

  async function handleOnChange(providerId: string) {
    console.log(info(`Selected provider: ${providerId}`));

    if (providerId === "qwen-oauth") {
      // Trigger Qwen OAuth flow
      try {
        console.log(info("🔐 Starting Qwen OAuth authentication..."));
        const successAuth = await qwenAuth.authenticate();

        if (successAuth) {
          console.log(success("✅ Qwen OAuth authentication successful!"));
          console.log(
            info("💡 Qwen models with OAuth are now available in the Models view")
          );
        } else {
          console.log(error("❌ Qwen OAuth authentication failed or was cancelled"));
        }
      } catch (error) {
        console.error(
          error("❌ Authentication error:"),
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    setView(Menu);
  }

  return (
    <AsyncView<Provider[]>
      title="Select Provider"
      fetcher={listProviders}
      onInput={handleInput}
    >
      {providers => {
        return (
          <SearchableSelect
            options={providers.map(provider => {
              let statusEmoji = "";
              switch (provider.status) {
                case "configured":
                  statusEmoji = "✅";
                  break;
                case "error":
                  statusEmoji = "❌";
                  break;
                default:
                  statusEmoji = "⏳";
              }

              return {
                label: `${statusEmoji} ${provider.name} - ${provider.description}`,
                value: provider.id
              };
            })}
            onChange={handleOnChange}
            placeholder="filter by name"
            maxItems={15}
          />
        );
      }}
    </AsyncView>
  );
};
