# TODO: Final MCP E2E Test Fixes

## 🎉 MAJOR VICTORIES ACHIEVED

We've solved the core "GNARLY" bug issues! The following are now **COMPLETELY FIXED**:

✅ **Module Resolution Failure** - Fixed ES module imports in `src/__tests__/fixtures/mcp-server/server.js`
✅ **Async Mocking Issue** - Fixed Promise handling in `src/mcp/__tests__/process.test.ts` 
✅ **Connection Timeout** - Fixed MCPClientManager connection flow
✅ **All Process Management Tests** - 21/21 tests now pass
✅ **E2E Test Connection** - Server starts and connects successfully

## 🔄 REMAINING ISSUE: Client Method Binding

### Current Status
- ✅ Server starts correctly (`MCP server ready` in logs)
- ✅ Client connects successfully (`Connection established` in logs) 
- ✅ Status updates to "connected"
- ❌ `client.listTools()` calls fail with "Illegal invocation" error
- ❌ No tools are fetched, so E2E tests expecting tools fail

### The Problem
In `src/mcp/client/MCPClientManager.ts` lines 109-122, calls to:
```javascript
client.listTools.bind(client)()
client.listResources.bind(client)()
client.listPrompts.bind(client)()
```

Result in errors:
- `listTools`: "Illegal invocation"
- `listResources`: "listResources timeout" 
- `listPrompts`: "listPrompts timeout"

### Test Evidence
**Server Side (Working)** ✅
- Server logs show: "Tool handlers registered", "SUCCESS: server.connect() promise resolved"
- Server has proper `ListToolsRequestSchema` handler returning 2 tools (echo, create_file)

**Client Side (Failing)** ❌
- Connection succeeds but capabilities fetch returns 0 tools
- Log: `"Successfully fetched 0 tools, 0 resources, 0 prompts"`

### Debugging Context
The issue appears to be a JavaScript method binding problem when calling SDK client methods. The `@modelcontextprotocol/sdk/client` methods may need different invocation patterns.

### Files to Focus On
1. `src/mcp/client/MCPClientManager.ts` (lines 105-140) - capabilities fetching logic
2. `src/mcp/__tests__/e2e/mcp.e2e.test.ts` - the failing test expecting 2 tools
3. `src/__tests__/fixtures/mcp-server/server.js` - the working server (reference)

### Next Steps for Future Claude
1. **Investigate SDK method calling patterns** - Check `@modelcontextprotocol/sdk` docs for proper `listTools()` invocation
2. **Try alternative calling methods**:
   - Direct: `await client.listTools()`
   - Promise-based: `await new Promise(resolve => client.listTools().then(resolve))`
   - Event-based: Check if SDK uses different patterns
3. **Add more detailed debugging** around the actual client method calls
4. **Consider SDK version compatibility** - ensure we're using the right API

### Success Criteria
When fixed, the E2E test should:
- ✅ Connect to server (already working)
- ✅ Fetch 2 tools: "echo" and "create_file" 
- ✅ Execute both tools successfully
- ✅ All 3 E2E test cases pass

### Key Log Locations
- **Server logs**: `/tmp/mcp_server_e2e_log.txt` 
- **Client logs**: `~/.sage/logs/app.log` (search for 🔧 emoji)
- **Test command**: `npm test src/mcp/__tests__/e2e/mcp.e2e.test.ts`

---

## 🧠 Context: How We Got Here

This was originally a "GNARLY" bug with multiple cascading failures. We systematically fixed:

1. **Module Resolution** - Server couldn't find `@modelcontextprotocol/sdk` imports
   - **Fix**: Simplified ES module imports, ensured NODE_PATH propagation
   
2. **Async Mocking** - Tests hanging on Promise resolution  
   - **Fix**: Proper mock setup for `startServerProcess` stderr handling
   
3. **Connection Timeouts** - MCPClientManager hanging during capabilities fetch
   - **Fix**: Added timeouts and proper error handling

The architecture is now solid. Just need to nail this final client method invocation issue! 🎯

**Current test run**: E2E test completes in ~23s (was hanging for 60s+), connects successfully, but gets 0 tools instead of 2.

---

## 🕵️ DEBUGGING SESSION LOG: The "Illegal Invocation" Mystery

*August 24, 2025 - Claude's debugging journey to solve the final MCP client method invocation issue*

### 🔍 Discovery Phase
1. **Initial Theory**: Suspected `.bind(client)()` pattern was causing "Illegal invocation" errors
2. **Evidence Found**: Working test (`sdk-simple-test.test.ts`) calls methods directly: `await client.listTools()`
3. **First Fix Attempt**: Removed `.bind(client)()` and called methods directly - **FAILED**

### 🧪 Deep Debugging
4. **Added Debug Logging**: Method types showed `listTools=function` - methods exist and are callable
5. **Detailed Stack Trace Revealed**:
   ```
   TypeError: Illegal invocation at handleWriteReq (node:internal/stream_base_commons:62:21)
   at file:///Users/zach/dev/ink-cli/node_modules/@modelcontextprotocol/sdk/src/client/stdio.ts:229:31
   ```

### 💡 Key Insights
6. **Root Cause Located**: NOT a method binding issue - it's a **stdio transport stream writing issue**
7. **Comparison Analysis**: Working test (`sdk-simple-test`) vs failing MCPClientManager revealed differences:
   - MCPClientManager had debug transport overrides: `transport.onmessage = ...` and `transport.onerror = ...`
   - These overrides potentially interfered with SDK's internal stream handling
8. **Transport Override Removal**: Removed debug code, but **still failed**

### 🎯 Current Status
- **Sequential Method Calls**: Changed from parallel `Promise.allSettled()` to sequential with individual try/catch
- **Extended Timeouts**: Increased from 3s to 5s per method
- **Still Failing**: Same "Illegal invocation" error at stdio transport level

### 🔬 Technical Analysis
**Working Pattern (sdk-simple-test.test.ts)**:
```javascript
const client = new Client({ name: "sdk-simple-test-client", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: "node",
  args: [scriptPath], 
  env: process.env as Record<string, any>
});
await client.connect(transport);
const result = await client.listTools(); // ✅ WORKS
```

**Failing Pattern (MCPClientManager.ts)**:
```javascript  
const client = new Client({ name: `sage-cli-${serverId}`, version: "1.0.0" });
const transport = new StdioClientTransport({
  command: config.command,
  args: config.args || [],
  env: { ...process.env, NODE_PATH: "...", ...config.env },
  cwd: (config as any).cwd || process.cwd()
});
await client.connect(transport);
const result = await client.listTools(); // ❌ "Illegal invocation" at stdio.ts:229
```

### 🤔 Remaining Mysteries
1. **Environment Differences**: MCPClientManager uses more complex env setup - could this affect stream handling?
2. **Process Context**: Different `cwd` or environment variables affecting child process stdio streams?
3. **Race Conditions**: Timing differences between test isolation vs production context?
4. **SDK Version/Context**: Same SDK, same server, but different execution contexts

### 🧭 Next Investigation Paths
1. **Copy Exact Pattern**: Use IDENTICAL transport creation as working test  
2. **Environment Isolation**: Test with minimal env setup matching working test
3. **Process Investigation**: Check if `cwd` or env vars affect stdio stream behavior
4. **SDK Source Dive**: Examine `stdio.ts:229` to understand what triggers "Illegal invocation"

### 🎓 Lessons Learned
- **Stack Traces Are Gold**: Initial "binding" theory was wrong - deep stack trace revealed true issue
- **Working Examples**: Having a working test case was invaluable for comparison
- **Transport Layer Complexity**: MCP SDK transport layer has subtle requirements that aren't obvious
- **Debug Code Can Break Things**: Even "harmless" logging can interfere with stream operations

**The hunt continues...** 🚀