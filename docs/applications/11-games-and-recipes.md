# 11 · Games, Guilds and Asset Recipes

**Research**

Games give asset ownership an immediate context: equipment can be used, guild inventories can be shared and
materials can become something new. Common asset rules let players inspect those relationships while most
gameplay stays in the environment best suited to running it.

AIBRC can supply the ownership foundation. Proposed locks, bindings and conditional transitions open
research paths for defined usage rights and deterministic asset recipes.

## Why it matters

Equipment rental, guild inventories, crafting and player-owned characters describe different economic relationships. Renting a sword transfers a use right, not necessarily ownership. A crafting recipe consumes materials and produces an item. A guild may own assets while delegating access to a player or an operating Agent.

Treating all of these as ordinary token transfers hides the distinction that makes each feature useful. A good game can keep most gameplay off-chain while exposing the asset rules that players need to trust.

## A practical example

A guild holds a collection of equipment and allocates temporary use to members. A member can play with an item for a defined interval without becoming entitled to sell the guild's property. A guild Agent can coordinate access and collect attributable service or game receipts under separately defined permissions.

A second scenario is crafting: a player approves a recipe that consumes specified materials and releases a specified result from a bounded inventory. A third is a persistent character with its own associated equipment, budget and history. Each scenario needs its own rights and state explanation; one does not automatically implement the others.

## Who pays, who earns

Revenue can come from gameplay, creative work, access or tools. Rentals compensate an owner for providing usable equipment; a guild's revenue distribution depends on its membership and work agreement. Tradable assets should support the game rather than require endless new buyers to fund existing players.

Random outcomes with economic value need an explained source of randomness and a way to check its use. An application cannot make randomness fair merely by attaching a later hash. A crafting rule should also explain who supplies the output inventory and whether any creation fee is retained when a request fails.

## How AIBRC fits

Current Deploy and Transfer provide fixed-supply assets and ownership movement. They do not define game execution, temporary usage rights, multi-material burning or atomic crafting. [AIP-0002](../../proposals/AIP-0002-multiasset-transfer.md), [AIP-0003](../../proposals/AIP-0003-lock.md) and [AIP-0007](../../proposals/AIP-0007-conditional.md) offer possible building blocks; a recipe still needs explicit state and failure semantics.

```text
Publish a recipe and bounded inventory
  → player checks materials and result
  → evaluate every required condition
  ├─ success → consume once, release once
  └─ failure → no protocol asset side effects
```

[AIP-0004](../../proposals/AIP-0004-bind.md) could support character and item relationships, and [AIP-0005](../../proposals/AIP-0005-attest.md) could support attributed results. A transfer allowance is not a game-item rental permission. The allowed actions, expiry and ownership effects of a usage grant would need independent specification.

## Building the first version

Before a protocol recipe is activated, demonstrate conservation, bounded reserve release, deterministic rounding and protection against concurrent double claims. Define whether “consume” means a real supply change, an unavailable reserve or another specified operation; sending to an ordinary account must not be described as burning without an applicable rule.

A failed asset instruction may still be carried by a confirmed Bitcoin transaction whose miner fee was paid. Protocol-level rollback of the recipe does not refund that fee. Model simulation and game-server tests are not proof that an on-chain rule is implemented.

An early product can use a conventional game with ordinary asset transfers to test demand. That leaves game outcomes with the game's operator while the asset layer remains independently interpretable.

**What it implements:** **Research.** Explore game assets, temporary use rights and deterministic combinations of material consumption and reserve release.\
**What it enables:** Players can inspect asset changes while games retain room to build engaging experiences.\
**In plain words:** A successful recipe should consume the right materials once; a failed recipe should not take them away.\
**Technical line:** `checked inputs + explicit use rights + bounded reserves → defined game-state outcome`.

## Where it can lead

Begin with one equipment right or one checkable recipe. Later work could connect portable inventories,
guild budgets and characters with replaceable operators. Smart Covenant's contribution is to make the asset
relationship explicit while leaving designers room to build the game around it.
