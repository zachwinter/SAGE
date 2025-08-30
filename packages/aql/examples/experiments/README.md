# AQL Research Experiments

This directory contains AQL queries designed for researching the effectiveness of different agent orchestration strategies, particularly focusing on maximizing the performance of smaller agents through strategic coordination.

## Experiments

### [tiny-model-effectiveness.aql](tiny-model-effectiveness.aql)

**Research Question**: Can small agents achieve high-performance results through better coordination?

**Strategy**: Multi-phase specialization with cross-verification

- Problem decomposition
- Parallel specialized analysis
- Cross-verification between specialists
- Iterative refinement
- Synthesis with minimal larger agent usage

**Run with**:

```bash
aql run tiny-model-effectiveness.aql --input '{
  "problem": "Design a sustainable urban transportation system for a city of 2 million people",
  "complexity": "high"
}'
```

### [model-comparison.aql](model-comparison.aql)

**Research Question**: What's the optimal way to combine different agent capabilities?

**Strategies Tested**:

1. **Single Large Agent**: Baseline approach
2. **Cascade**: Small → Medium → Large progression
3. **Ensemble Voting**: Multiple small agents with consensus
4. **Specialized Coordination**: Expert agents with coordination
5. **Debate & Refinement**: Adversarial improvement

**Run with**:

```bash
aql run model-comparison.aql --input '{
  "task": "Develop a marketing strategy for a new sustainable product",
  "evaluation_criteria": ["creativity", "feasibility", "cost-effectiveness", "market_impact"]
}'
```

## Research Hypotheses

### H1: Specialization Beats Generalization

Small agents with specific roles will outperform general-purpose large agents on focused tasks.

### H2: Verification Improves Quality

Cross-verification between specialized agents reduces errors and improves output quality.

### H3: Iterative Refinement Scales Performance

Multiple rounds of refinement can achieve quality comparable to much larger agents.

### H4: Ensemble Consensus Reduces Variance

Multiple small agents voting/consensus reduces individual agent biases and errors.

### H5: Debate Improves Reasoning

Adversarial processes between agents improve logical reasoning and identify weak points.

## Metrics to Track

### Quality Metrics

- **Completeness**: Does the solution address all aspects?
- **Accuracy**: Are the facts and reasoning correct?
- **Creativity**: Novel or innovative approaches?
- **Feasibility**: Practical and implementable?

### Efficiency Metrics

- **Total Tokens**: Token usage across all agents
- **Execution Time**: End-to-end processing time
- **Cost Effectiveness**: Quality per unit of compute
- **Parallelization Benefit**: Speedup from parallel execution

### Agent Usage Patterns

- **Small Agent Utilization**: How effectively are small agents used?
- **Large Agent Dependency**: When are larger agents actually needed?
- **Specialization Effectiveness**: Do specialized roles improve performance?
- **Coordination Overhead**: Cost of agent coordination vs. benefits

## Running Experiments

### Prerequisites

```bash
# Ensure agent execution system is running
# (specific setup depends on your agent execution framework)

# Pull required agents (setup depends on your framework)
# Example placeholder commands:
# agent-manager pull small-agent
# agent-manager pull medium-agent
# agent-manager pull large-agent
```

### Basic Execution

```bash
# Run single experiment
aql run experiments/tiny-model-effectiveness.aql --input-file problem.json --debug

# Compare strategies
aql run experiments/model-comparison.aql --input-file task.json --debug
```

### Batch Testing

```bash
# Test multiple problems
for problem in problems/*.json; do
  echo "Testing: $problem"
  aql run tiny-model-effectiveness.aql --input-file "$problem" > "results/$(basename "$problem" .json).json"
done
```

## Input Examples

### problem.json (for tiny-model-effectiveness.aql)

```json
{
  "problem": "Design a decentralized social media platform that addresses privacy concerns while maintaining user engagement",
  "complexity": "high"
}
```

### task.json (for model-comparison.aql)

```json
{
  "task": "Create a comprehensive business plan for a vertical farming startup targeting urban markets",
  "evaluation_criteria": [
    "market_analysis_depth",
    "financial_projections_accuracy",
    "operational_feasibility",
    "competitive_differentiation",
    "scalability_potential"
  ]
}
```

## Expected Research Insights

### Agent Orchestration Patterns

- Which coordination patterns work best for different problem types?
- How does problem complexity affect optimal strategy choice?
- When is the overhead of coordination worth the quality improvement?

### Small Agent Optimization

- What specialized roles maximize small agent effectiveness?
- How much context should each specialist agent receive?
- What's the optimal creativity settings for different roles?

### Quality vs. Efficiency Trade-offs

- At what point do diminishing returns set in for additional agents?
- How does parallel execution improve both speed and quality?
- What's the sweet spot for agent capabilities in different roles?

## Contributing New Experiments

When adding new experiments:

1. **Clear Research Question**: State what you're trying to discover
2. **Controlled Variables**: Test one strategy dimension at a time
3. **Measurable Outcomes**: Define success metrics upfront
4. **Reproducible Setup**: Include input examples and expected outputs
5. **Documentation**: Explain the hypothesis and methodology

## Future Experiment Ideas

- **Context Window Optimization**: How does context size affect coordination?
- **Creativity Tuning**: Optimal creativity settings for different roles
- **Dynamic Role Assignment**: Agents that choose their own specializations
- **Failure Recovery**: How to handle when individual agents fail
- **Multi-Modal Coordination**: Combining text, code, and structured output agents