# AQL Examples

This directory contains comprehensive examples demonstrating AQL's capabilities across different complexity levels and use cases.

## Directory Structure

```
examples/
├── basic/              # Fundamental AQL concepts
├── advanced/           # Complex multi-agent workflows
├── use-cases/          # Real-world applications
└── README.md          # This file
```

## Basic Examples

### [hello-world.aql](basic/hello-world.aql)

The simplest AQL query - demonstrates basic agent invocation and variable usage.

**Concepts**: Basic query structure, variables, agent configuration

### [sequential-chain.aql](basic/sequential-chain.aql)

Shows how operations execute in sequence, with each step building on the previous.

**Concepts**: Sequential execution, data flow, different model usage

### [parallel-processing.aql](basic/parallel-processing.aql)

Demonstrates parallel execution where multiple agents work simultaneously.

**Concepts**: Parallel blocks, result aggregation, efficiency optimization

### [conditional-logic.aql](basic/conditional-logic.aql)

Shows conditional execution based on results and quality thresholds.

**Concepts**: If/else statements, structured outputs, quality control

## Advanced Examples

### [multi-agent-debate.aql](advanced/multi-agent-debate.aql)

Complex multi-agent system where agents debate a topic over multiple rounds.

**Concepts**:

- Multi-round interactions
- Agent roles and perspectives
- State management across rounds
- Iterative refinement
- Consensus building

### [content-pipeline.aql](advanced/content-pipeline.aql)

Sophisticated content creation pipeline with quality control and optimization.

**Concepts**:

- Multi-phase workflows
- Parallel quality assessment
- Conditional improvement logic
- Structured data types
- Meta-content generation

## Real-World Use Cases

### [customer-support.aql](use-cases/customer-support.aql)

Automated customer support system with intelligent routing and escalation.

**Features**:

- Multi-dimensional issue analysis
- Customer profile assessment
- Sentiment-aware responses
- Escalation logic
- Quality assurance
- Follow-up planning

### [code-review.aql](use-cases/code-review.aql)

Comprehensive automated code review system analyzing multiple dimensions.

**Features**:

- Security vulnerability detection
- Performance analysis
- Code quality metrics
- Architecture review
- Testing assessment
- Documentation evaluation
- Prioritized recommendations

### [research-synthesis.aql](use-cases/research-synthesis.aql)

Academic research synthesis from multiple sources with credibility assessment.

**Features**:

- Source credibility evaluation
- Thematic analysis
- Consensus and conflict identification
- Gap analysis
- Evidence quality assessment
- Implications and applications
- Future research directions

## Key Concepts Demonstrated

### Agent Orchestration

- **Sequential chains**: Operations that build on previous results
- **Parallel processing**: Independent operations running simultaneously
- **Conditional execution**: Dynamic workflow based on results
- **Iterative loops**: Repeated operations with state management

### Data Management

- **Type definitions**: Custom structured data types
- **Variable scoping**: Local and global variable management
- **Context passing**: Maintaining state across operations
- **Result aggregation**: Combining multiple agent outputs

### Quality Control

- **Multi-dimensional assessment**: Analyzing different aspects in parallel
- **Threshold-based decisions**: Automated quality gates
- **Fallback strategies**: Handling edge cases and failures
- **Iterative improvement**: Refining results based on feedback

### Provider Integration

- **Multi-provider usage**: Mixing different LLM providers
- **Model specialization**: Using specific models for specific tasks
- **Configuration management**: Per-operation and global settings
- **Error handling**: Robust failure recovery

## Running Examples

_Note: AQL is currently in design phase. These examples show the intended syntax and capabilities._

Once the AQL runtime is implemented, you'll be able to run these examples:

```bash
# Run a basic example
aql run examples/basic/hello-world.aql --input name="Alice"

# Run advanced example with parameters
aql run examples/advanced/multi-agent-debate.aql \
  --input topic="Universal Basic Income" \
  --input rounds=5

# Run use case with complex input
aql run examples/use-cases/customer-support.aql \
  --input customer_message="My order hasn't arrived" \
  --input priority="high"
```

## Best Practices Demonstrated

1. **Modularity**: Breaking complex workflows into logical phases
2. **Reusability**: Using fragments and functions for common patterns
3. **Error Handling**: Robust error recovery and fallback strategies
4. **Type Safety**: Using structured types for reliable data flow
5. **Performance**: Optimizing with parallel execution where appropriate
6. **Maintainability**: Clear naming and documentation in queries

## Contributing Examples

When adding new examples:

1. **Start Simple**: Begin with basic concepts before advanced features
2. **Document Thoroughly**: Include comments explaining key concepts
3. **Use Real Scenarios**: Base examples on actual use cases
4. **Show Progressions**: Demonstrate how to build complexity gradually
5. **Include Types**: Use structured types for complex data
6. **Handle Errors**: Show proper error handling and fallbacks

## Example Categories

### By Complexity

- **Beginner**: Single agent, simple data flow
- **Intermediate**: Multiple agents, parallel processing
- **Advanced**: Complex workflows, custom types, error handling
- **Expert**: Production-ready systems with full feature usage

### By Domain

- **Content Creation**: Writing, editing, SEO optimization
- **Customer Service**: Support, escalation, quality assurance
- **Code Analysis**: Review, testing, security assessment
- **Research**: Synthesis, analysis, gap identification
- **Business Intelligence**: Data analysis, reporting, insights

### By Pattern

- **Pipeline**: Sequential processing with quality gates
- **Debate**: Multi-agent consensus building
- **Assessment**: Multi-dimensional evaluation
- **Synthesis**: Combining multiple sources or perspectives
- **Orchestration**: Complex workflow management

Each example is designed to teach specific concepts while solving real-world problems, making AQL both educational and practical.
