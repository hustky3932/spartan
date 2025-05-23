Project Path: src

Source Tree:

```
src
├── providers
│   ├── evaluators.ts
│   ├── relationships.ts
│   ├── recentMessages.ts
│   ├── knowledge.ts
│   ├── entities.ts
│   ├── character.ts
│   ├── settings.ts
│   ├── capabilities.ts
│   ├── providers.ts
│   ├── attachments.ts
│   ├── actions.ts
│   ├── choice.ts
│   ├── anxiety.ts
│   ├── roles.ts
│   ├── index.ts
│   ├── world.ts
│   ├── facts.ts
│   ├── shouldRespond.ts
│   └── time.ts
├── evaluators
│   ├── reflection.ts
│   └── index.ts
├── actions
│   ├── reply.ts
│   ├── updateEntity.ts
│   ├── muteRoom.ts
│   ├── settings.ts
│   ├── unfollowRoom.ts
│   ├── ignore.ts
│   ├── choice.ts
│   ├── followRoom.ts
│   ├── roles.ts
│   ├── index.ts
│   ├── none.ts
│   ├── sendMessage.ts
│   └── unmuteRoom.ts
├── index.ts
└── services
    ├── scenario.ts
    ├── index.ts
    └── task.ts

```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/evaluators.ts`:

```ts
import type {
  ActionExample,
  Evaluator,
  IAgentRuntime,
  Memory,
  Provider,
  State,
} from '@elizaos/core';
import { addHeader } from '@elizaos/core';
import { names, uniqueNamesGenerator } from 'unique-names-generator';

/**
 * Formats the names of evaluators into a comma-separated list, each enclosed in single quotes.
 * @param evaluators - An array of evaluator objects.
 * @returns A string that concatenates the names of all evaluators, each enclosed in single quotes and separated by commas.
 */
/**
 * Formats the names of the evaluators in the provided array.
 *
 * @param {Evaluator[]} evaluators - Array of evaluators.
 * @returns {string} - Formatted string of evaluator names.
 */
export function formatEvaluatorNames(evaluators: Evaluator[]) {
  return evaluators.map((evaluator: Evaluator) => `'${evaluator.name}'`).join(',\n');
}

/**
 * Formats evaluator examples into a readable string, replacing placeholders with generated names.
 * @param evaluators - An array of evaluator objects, each containing examples to format.
 * @returns A string that presents each evaluator example in a structured format, including context, messages, and outcomes, with placeholders replaced by generated names.
 */
export function formatEvaluatorExamples(evaluators: Evaluator[]) {
  return evaluators
    .map((evaluator) => {
      return evaluator.examples
        .map((example) => {
          const exampleNames = Array.from({ length: 5 }, () =>
            uniqueNamesGenerator({ dictionaries: [names] })
          );

          let formattedPrompt = example.prompt;
          let formattedOutcome = example.outcome;

          exampleNames.forEach((name, index) => {
            const placeholder = `{{name${index + 1}}}`;
            formattedPrompt = formattedPrompt.replaceAll(placeholder, name);
            formattedOutcome = formattedOutcome.replaceAll(placeholder, name);
          });

          const formattedMessages = example.messages
            .map((message: ActionExample) => {
              let messageString = `${message.name}: ${message.content.text}`;
              exampleNames.forEach((name, index) => {
                const placeholder = `{{name${index + 1}}}`;
                messageString = messageString.replaceAll(placeholder, name);
              });
              return (
                messageString +
                (message.content.action || message.content.actions
                  ? ` (${message.content.action || message.content.actions?.join(', ')})`
                  : '')
              );
            })
            .join('\n');

          return `Prompt:\n${formattedPrompt}\n\nMessages:\n${formattedMessages}\n\nOutcome:\n${formattedOutcome}`;
        })
        .join('\n\n');
    })
    .join('\n\n');
}

/**
 * Formats evaluator details into a string, including both the name and description of each evaluator.
 * @param evaluators - An array of evaluator objects.
 * @returns A string that concatenates the name and description of each evaluator, separated by a colon and a newline character.
 */
export function formatEvaluators(evaluators: Evaluator[]) {
  return evaluators
    .map((evaluator: Evaluator) => `'${evaluator.name}: ${evaluator.description}'`)
    .join(',\n');
}

export const evaluatorsProvider: Provider = {
  name: 'EVALUATORS',
  description: 'Evaluators that can be used to evaluate the conversation after responding',
  private: true,
  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    // Get evaluators that validate for this message
    const evaluatorPromises = runtime.evaluators.map(async (evaluator: Evaluator) => {
      const result = await evaluator.validate(runtime, message, state);
      if (result) {
        return evaluator;
      }
      return null;
    });

    // Wait for all validations
    const resolvedEvaluators = await Promise.all(evaluatorPromises);

    // Filter out null values
    const evaluatorsData = resolvedEvaluators.filter(Boolean) as Evaluator[];

    // Format evaluator-related texts
    const evaluators =
      evaluatorsData.length > 0
        ? addHeader('# Available Evaluators', formatEvaluators(evaluatorsData))
        : '';

    const evaluatorNames = evaluatorsData.length > 0 ? formatEvaluatorNames(evaluatorsData) : '';

    const evaluatorExamples =
      evaluatorsData.length > 0
        ? addHeader('# Evaluator Examples', formatEvaluatorExamples(evaluatorsData))
        : '';

    const values = {
      evaluatorsData,
      evaluators,
      evaluatorNames,
      evaluatorExamples,
    };

    // Combine all text sections
    const text = [evaluators, evaluatorExamples].filter(Boolean).join('\n\n');

    return {
      values,
      text,
    };
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/relationships.ts`:

```ts
import type { Entity, IAgentRuntime, Memory, Provider, Relationship, UUID } from '@elizaos/core';
/**
 * Formats the provided relationships based on interaction strength and returns a string.
 * @param {IAgentRuntime} runtime - The runtime object to interact with the agent.
 * @param {Relationship[]} relationships - The relationships to format.
 * @returns {string} The formatted relationships as a string.
 */
/**
 * Asynchronously formats relationships based on their interaction strength.
 *
 * @param {IAgentRuntime} runtime The runtime instance.
 * @param {Relationship[]} relationships The relationships to be formatted.
 * @returns {Promise<string>} A formatted string of the relationships.
 */
async function formatRelationships(runtime: IAgentRuntime, relationships: Relationship[]) {
  // Sort relationships by interaction strength (descending)
  const sortedRelationships = relationships
    .filter((rel) => rel.metadata?.interactions)
    .sort((a, b) => (b.metadata?.interactions || 0) - (a.metadata?.interactions || 0))
    .slice(0, 30); // Get top 30

  if (sortedRelationships.length === 0) {
    return '';
  }

  // Deduplicate target entity IDs to avoid redundant fetches
  const uniqueEntityIds = Array.from(
    new Set(sortedRelationships.map((rel) => rel.targetEntityId as UUID))
  );

  // Fetch all required entities in a single batch operation
  const entities = await Promise.all(uniqueEntityIds.map((id) => runtime.getEntityById(id)));

  // Create a lookup map for efficient access
  const entityMap = new Map<string, Entity | null>();
  entities.forEach((entity, index) => {
    if (entity) {
      entityMap.set(uniqueEntityIds[index], entity);
    }
  });

  const formatMetadata = (metadata: any) => {
    return JSON.stringify(
      Object.entries(metadata)
        .map(
          ([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`
        )
        .join('\n')
    );
  };

  // Format relationships using the entity map
  const formattedRelationships = sortedRelationships
    .map((rel) => {
      const targetEntityId = rel.targetEntityId as UUID;
      const entity = entityMap.get(targetEntityId);

      if (!entity) {
        return null;
      }

      const names = entity.names.join(' aka ');
      return `${names}\n${
        rel.tags ? rel.tags.join(', ') : ''
      }\n${formatMetadata(entity.metadata)}\n`;
    })
    .filter(Boolean);

  return formattedRelationships.join('\n');
}

/**
 * Provider for fetching relationships data.
 *
 * @type {Provider}
 * @property {string} name - The name of the provider ("RELATIONSHIPS").
 * @property {string} description - Description of the provider.
 * @property {Function} get - Asynchronous function to fetch relationships data.
 * @param {IAgentRuntime} runtime - The agent runtime object.
 * @param {Memory} message - The message object containing entity ID.
 * @returns {Promise<Object>} Object containing relationships data or error message.
 */
const relationshipsProvider: Provider = {
  name: 'RELATIONSHIPS',
  description:
    'Relationships between {{agentName}} and other people, or between other people that {{agentName}} has observed interacting with',
  dynamic: true,
  get: async (runtime: IAgentRuntime, message: Memory) => {
    // Get all relationships for the current user
    const relationships = await runtime.getRelationships({
      entityId: message.entityId,
    });

    if (!relationships || relationships.length === 0) {
      return {
        data: {
          relationships: [],
        },
        values: {
          relationships: 'No relationships found.',
        },
        text: 'No relationships found.',
      };
    }

    const formattedRelationships = await formatRelationships(runtime, relationships);

    if (!formattedRelationships) {
      return {
        data: {
          relationships: [],
        },
        values: {
          relationships: 'No relationships found.',
        },
        text: 'No relationships found.',
      };
    }
    return {
      data: {
        relationships: formattedRelationships,
      },
      values: {
        relationships: formattedRelationships,
      },
      text: `# ${runtime.character.name} has observed ${message.content.senderName || message.content.name} interacting with these people:\n${formattedRelationships}`,
    };
  },
};

export { relationshipsProvider };
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/recentMessages.ts`:

```ts
import {
  addHeader,
  ChannelType,
  CustomMetadata,
  formatMessages,
  formatPosts,
  getEntityDetails,
  type Entity,
  type IAgentRuntime,
  type Memory,
  type Provider,
  type UUID,
  logger,
} from '@elizaos/core';

// Move getRecentInteractions outside the provider
/**
 * Retrieves the recent interactions between two entities in a specific context.
 *
 * @param {IAgentRuntime} runtime - The agent runtime object.
 * @param {UUID} sourceEntityId - The UUID of the source entity.
 * @param {UUID} targetEntityId - The UUID of the target entity.
 * @param {UUID} excludeRoomId - The UUID of the room to exclude from the search.
 * @returns {Promise<Memory[]>} A promise that resolves to an array of Memory objects representing recent interactions.
 */
/**
 * Retrieves the recent interactions between two entities in different rooms excluding a specific room.
 * @param {IAgentRuntime} runtime - The agent runtime object.
 * @param {UUID} sourceEntityId - The UUID of the source entity.
 * @param {UUID} targetEntityId - The UUID of the target entity.
 * @param {UUID} excludeRoomId - The UUID of the room to exclude from the search.
 * @returns {Promise<Memory[]>} An array of Memory objects representing recent interactions between the two entities.
 */
const getRecentInteractions = async (
  runtime: IAgentRuntime,
  sourceEntityId: UUID,
  targetEntityId: UUID,
  excludeRoomId: UUID
): Promise<Memory[]> => {
  // Find all rooms where sourceEntityId and targetEntityId are participants
  const rooms = await runtime.getRoomsForParticipants([sourceEntityId, targetEntityId]);

  // Check the existing memories in the database
  return runtime.getMemoriesByRoomIds({
    tableName: 'messages',
    // filter out the current room id from rooms
    roomIds: rooms.filter((room) => room !== excludeRoomId),
    limit: 20,
  });
};

/**
 * A provider object that retrieves recent messages, interactions, and memories based on a given message.
 * @typedef {object} Provider
 * @property {string} name - The name of the provider ("RECENT_MESSAGES").
 * @property {string} description - A description of the provider's purpose ("Recent messages, interactions and other memories").
 * @property {number} position - The position of the provider (100).
 * @property {Function} get - Asynchronous function that retrieves recent messages, interactions, and memories.
 * @param {IAgentRuntime} runtime - The runtime context for the agent.
 * @param {Memory} message - The message to retrieve data from.
 * @returns {object} An object containing data, values, and text sections.
 */
export const recentMessagesProvider: Provider = {
  name: 'RECENT_MESSAGES',
  description: 'Recent messages, interactions and other memories',
  position: 100,
  get: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      const { roomId } = message;
      const conversationLength = runtime.getConversationLength();

      // Parallelize initial data fetching operations including recentInteractions
      const [entitiesData, room, recentMessagesData, recentInteractionsData] = await Promise.all([
        getEntityDetails({ runtime, roomId }),
        runtime.getRoom(roomId),
        runtime.getMemories({
          tableName: 'messages',
          roomId,
          count: conversationLength,
          unique: false,
        }),
        message.entityId !== runtime.agentId
          ? getRecentInteractions(runtime, message.entityId, runtime.agentId, roomId)
          : Promise.resolve([]),
      ]);

      // Default to message format if room is not found or type is undefined
      const isPostFormat = room?.type
        ? room.type === ChannelType.FEED || room.type === ChannelType.THREAD
        : false;

      // Format recent messages and posts in parallel
      const [formattedRecentMessages, formattedRecentPosts] = await Promise.all([
        formatMessages({
          messages: recentMessagesData,
          entities: entitiesData,
        }),
        formatPosts({
          messages: recentMessagesData,
          entities: entitiesData,
          conversationHeader: false,
        }),
      ]);

      // Create formatted text with headers
      const recentPosts =
        formattedRecentPosts && formattedRecentPosts.length > 0
          ? addHeader('# Posts in Thread', formattedRecentPosts)
          : '';

      const recentMessages =
        formattedRecentMessages && formattedRecentMessages.length > 0
          ? addHeader('# Conversation Messages', formattedRecentMessages)
          : '';

      // If there are no messages at all, and no current message to process, return a specific message.
      // The check for recentMessagesData.length === 0 ensures we only show this if there's truly nothing.
      if (
        !recentPosts &&
        !recentMessages &&
        recentMessagesData.length === 0 &&
        !message.content.text
      ) {
        return {
          data: {
            recentMessages: [],
            recentInteractions: [],
          },
          values: {
            recentPosts: '',
            recentMessages: '',
            recentMessageInteractions: '',
            recentPostInteractions: '',
            recentInteractions: '',
          },
          text: 'No recent messages available',
        };
      }

      const metaData = message.metadata as CustomMetadata;
      const senderName =
        entitiesData.find((entity: Entity) => entity.id === message.entityId)?.names[0] ||
        metaData?.entityName ||
        'Unknown User';
      const receivedMessageContent = message.content.text;

      const hasReceivedMessage = !!receivedMessageContent?.trim();

      const receivedMessageHeader = hasReceivedMessage
        ? addHeader('# Received Message', `${senderName}: ${receivedMessageContent}`)
        : '';

      const focusHeader = hasReceivedMessage
        ? addHeader(
            '# Focus your response',
            `You are replying to the above message from **${senderName}**. Keep your answer relevant to that message. Do not repeat earlier replies unless the sender asks again.`
          )
        : '';

      // Preload all necessary entities for both types of interactions
      const interactionEntityMap = new Map<UUID, Entity>();

      // Only proceed if there are interactions to process
      if (recentInteractionsData.length > 0) {
        // Get unique entity IDs that aren't the runtime agent
        const uniqueEntityIds = [
          ...new Set(
            recentInteractionsData
              .map((message) => message.entityId)
              .filter((id) => id !== runtime.agentId)
          ),
        ];

        // Create a Set for faster lookup
        const uniqueEntityIdSet = new Set(uniqueEntityIds);

        // Add entities already fetched in entitiesData to the map
        const entitiesDataIdSet = new Set<UUID>();
        entitiesData.forEach((entity) => {
          if (uniqueEntityIdSet.has(entity.id)) {
            interactionEntityMap.set(entity.id, entity);
            entitiesDataIdSet.add(entity.id);
          }
        });

        // Get the remaining entities that weren't already loaded
        // Use Set difference for efficient filtering
        const remainingEntityIds = uniqueEntityIds.filter((id) => !entitiesDataIdSet.has(id));

        // Only fetch the entities we don't already have
        if (remainingEntityIds.length > 0) {
          const entities = await Promise.all(
            remainingEntityIds.map((entityId) => runtime.getEntityById(entityId))
          );

          entities.forEach((entity, index) => {
            if (entity) {
              interactionEntityMap.set(remainingEntityIds[index], entity);
            }
          });
        }
      }

      // Format recent message interactions
      const getRecentMessageInteractions = async (
        recentInteractionsData: Memory[]
      ): Promise<string> => {
        // Format messages using the pre-fetched entities
        const formattedInteractions = recentInteractionsData.map((message) => {
          const isSelf = message.entityId === runtime.agentId;
          let sender: string;

          if (isSelf) {
            sender = runtime.character.name;
          } else {
            sender = interactionEntityMap.get(message.entityId)?.metadata?.username || 'unknown';
          }

          return `${sender}: ${message.content.text}`;
        });

        return formattedInteractions.join('\n');
      };

      // Format recent post interactions
      const getRecentPostInteractions = async (
        recentInteractionsData: Memory[],
        entities: Entity[]
      ): Promise<string> => {
        // Combine pre-loaded entities with any other entities
        const combinedEntities = [...entities];

        // Add entities from interactionEntityMap that aren't already in entities
        const actorIds = new Set(entities.map((entity) => entity.id));
        for (const [id, entity] of interactionEntityMap.entries()) {
          if (!actorIds.has(id)) {
            combinedEntities.push(entity);
          }
        }

        const formattedInteractions = formatPosts({
          messages: recentInteractionsData,
          entities: combinedEntities,
          conversationHeader: true,
        });

        return formattedInteractions;
      };

      // Process both types of interactions in parallel
      const [recentMessageInteractions, recentPostInteractions] = await Promise.all([
        getRecentMessageInteractions(recentInteractionsData),
        getRecentPostInteractions(recentInteractionsData, entitiesData),
      ]);

      const data = {
        recentMessages: recentMessagesData,
        recentInteractions: recentInteractionsData,
      };

      const values = {
        recentPosts,
        recentMessages,
        recentMessageInteractions,
        recentPostInteractions,
        recentInteractions: isPostFormat ? recentPostInteractions : recentMessageInteractions,
      };

      // Combine all text sections
      const text = [
        isPostFormat ? recentPosts : recentMessages,
        // Only add received message and focus headers if there are messages or a current message to process
        recentMessages || recentPosts || message.content.text ? receivedMessageHeader : '',
        recentMessages || recentPosts || message.content.text ? focusHeader : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      return {
        data,
        values,
        text,
      };
    } catch (error) {
      logger.error('Error in recentMessagesProvider:', error);
      // Return a default state in case of error, similar to the empty message list
      return {
        data: {
          recentMessages: [],
          recentInteractions: [],
        },
        values: {
          recentPosts: '',
          recentMessages: '',
          recentMessageInteractions: '',
          recentPostInteractions: '',
          recentInteractions: '',
        },
        text: 'Error retrieving recent messages.', // Or 'No recent messages available' as the test expects
      };
    }
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/knowledge.ts`:

```ts
import type { IAgentRuntime, Memory, Provider } from '@elizaos/core';
import { addHeader } from '@elizaos/core';

/**
 * Represents a knowledge provider that retrieves knowledge from the knowledge base.
 * @type {Provider}
 * @property {string} name - The name of the knowledge provider.
 * @property {string} description - The description of the knowledge provider.
 * @property {boolean} dynamic - Indicates if the knowledge provider is dynamic or static.
 * @property {Function} get - Asynchronously retrieves knowledge from the knowledge base.
 * @param {IAgentRuntime} runtime - The agent runtime object.
 * @param {Memory} message - The message containing the query for knowledge retrieval.
 * @returns {Object} An object containing the retrieved knowledge data, values, and text.
 */
export const knowledgeProvider: Provider = {
  name: 'KNOWLEDGE',
  description:
    'Knowledge from the knowledge base that the agent knows, retrieved whenever the agent needs to answer a question about their expertise.',
  dynamic: true,
  get: async (runtime: IAgentRuntime, message: Memory) => {
    const knowledgeData = await runtime.getKnowledge(message);

    const firstFiveKnowledgeItems = knowledgeData?.slice(0, 5);

    let knowledge =
      (firstFiveKnowledgeItems && firstFiveKnowledgeItems.length > 0
        ? addHeader(
            '# Knowledge',
            firstFiveKnowledgeItems.map((knowledge) => `- ${knowledge.content.text}`).join('\n')
          )
        : '') + '\n';

    const tokenLength = 3.5;

    if (knowledge.length > 4000 * tokenLength) {
      knowledge = knowledge.slice(0, 4000 * tokenLength);
    }

    return {
      data: {
        knowledge,
      },
      values: {
        knowledge,
      },
      text: knowledge,
    };
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/entities.ts`:

```ts
import type { Entity, IAgentRuntime, Memory, Provider } from '@elizaos/core';
import { addHeader, formatEntities, getEntityDetails } from '@elizaos/core';

/**
 * Provider for fetching entities related to the current conversation.
 * @type { Provider }
 */
export const entitiesProvider: Provider = {
  name: 'ENTITIES',
  description: 'People in the current conversation',
  dynamic: true,
  get: async (runtime: IAgentRuntime, message: Memory) => {
    const { roomId, entityId } = message;
    // Get entities details
    const entitiesData = await getEntityDetails({ runtime, roomId });
    // Format entities for display
    const formattedEntities = formatEntities({ entities: entitiesData ?? [] });
    // Find sender name
    const senderName = entitiesData?.find((entity: Entity) => entity.id === entityId)?.names[0];
    // Create formatted text with header
    const entities =
      formattedEntities && formattedEntities.length > 0
        ? addHeader('# People in the Room', formattedEntities)
        : '';
    const data = {
      entitiesData,
      senderName,
    };

    const values = {
      entities,
    };

    return {
      data,
      values,
      text: entities,
    };
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/character.ts`:

```ts
import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { addHeader, ChannelType } from '@elizaos/core';

/**
 * Character provider object.
 * @typedef {Object} Provider
 * @property {string} name - The name of the provider ("CHARACTER").
 * @property {string} description - Description of the character information.
 * @property {Function} get - Async function to get character information.
 */
/**
 * Provides character information.
 * @param {IAgentRuntime} runtime - The agent runtime.
 * @param {Memory} message - The message memory.
 * @param {State} state - The state of the character.
 * @returns {Object} Object containing values, data, and text sections.
 */
export const characterProvider: Provider = {
  name: 'CHARACTER',
  description: 'Character information',
  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    const character = runtime.character;

    // Character name
    const agentName = character.name;

    // Handle bio (string or random selection from array)
    const bioText = Array.isArray(character.bio)
      ? character.bio
          .sort(() => 0.5 - Math.random())
          .slice(0, 10)
          .join(' ')
      : character.bio || '';

    const bio = addHeader(`# About ${character.name}`, bioText);

    // System prompt
    const system = character.system ?? '';

    // Select random topic if available
    const topicString =
      character.topics && character.topics.length > 0
        ? character.topics[Math.floor(Math.random() * character.topics.length)]
        : null;

    // postCreationTemplate in core prompts.ts
    // Write a post that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Do not add commentary or acknowledge this request, just write the post.
    // Write a post that is {{Spartan is dirty}} about {{Spartan is currently}}
    const topic = topicString || '';

    // Format topics list
    const topics =
      character.topics && character.topics.length > 0
        ? `${character.name} is also interested in ${character.topics
            .filter((topic) => topic !== topicString)
            .sort(() => 0.5 - Math.random())
            .slice(0, 5)
            .map((topic, index, array) => {
              if (index === array.length - 2) {
                return `${topic} and `;
              }
              if (index === array.length - 1) {
                return topic;
              }
              return `${topic}, `;
            })
            .join('')}`
        : '';

    // Select random adjective if available
    const adjectiveString =
      character.adjectives && character.adjectives.length > 0
        ? character.adjectives[Math.floor(Math.random() * character.adjectives.length)]
        : '';

    const adjective = adjectiveString || '';

    // Format post examples
    const formattedCharacterPostExamples = !character.postExamples
      ? ''
      : character.postExamples
          .sort(() => 0.5 - Math.random())
          .map((post) => {
            const messageString = `${post}`;
            return messageString;
          })
          .slice(0, 50)
          .join('\n');

    const characterPostExamples =
      formattedCharacterPostExamples &&
      formattedCharacterPostExamples.replaceAll('\n', '').length > 0
        ? addHeader(`# Example Posts for ${character.name}`, formattedCharacterPostExamples)
        : '';

    // Format message examples
    const formattedCharacterMessageExamples = !character.messageExamples
      ? ''
      : character.messageExamples
          .sort(() => 0.5 - Math.random())
          .slice(0, 5)
          .map((example) => {
            const exampleNames = Array.from({ length: 5 }, () =>
              Math.random().toString(36).substring(2, 8)
            );

            return example
              .map((message) => {
                let messageString = `${message.name}: ${message.content.text}${
                  message.content.action || message.content.actions
                    ? ` (actions: ${message.content.action || message.content.actions?.join(', ')})`
                    : ''
                }`;
                exampleNames.forEach((name, index) => {
                  const placeholder = `{{name${index + 1}}}`;
                  messageString = messageString.replaceAll(placeholder, name);
                });
                return messageString;
              })
              .join('\n');
          })
          .join('\n\n');

    const characterMessageExamples =
      formattedCharacterMessageExamples &&
      formattedCharacterMessageExamples.replaceAll('\n', '').length > 0
        ? addHeader(
            `# Example Conversations for ${character.name}`,
            formattedCharacterMessageExamples
          )
        : '';

    const room = state.data.room ?? (await runtime.getRoom(message.roomId));

    const isPostFormat = room?.type === ChannelType.FEED || room?.type === ChannelType.THREAD;

    // Style directions
    const postDirections =
      (character?.style?.all?.length && character?.style?.all?.length > 0) ||
      (character?.style?.post?.length && character?.style?.post?.length > 0)
        ? addHeader(
            `# Post Directions for ${character.name}`,
            (() => {
              const all = character?.style?.all || [];
              const post = character?.style?.post || [];
              return [...all, ...post].join('\n');
            })()
          )
        : '';

    const messageDirections =
      (character?.style?.all?.length && character?.style?.all?.length > 0) ||
      (character?.style?.chat?.length && character?.style?.chat?.length > 0)
        ? addHeader(
            `# Message Directions for ${character.name}`,
            (() => {
              const all = character?.style?.all || [];
              const chat = character?.style?.chat || [];
              return [...all, ...chat].join('\n');
            })()
          )
        : '';

    const directions = isPostFormat ? postDirections : messageDirections;
    const examples = isPostFormat ? characterPostExamples : characterMessageExamples;

    const values = {
      agentName,
      bio,
      system,
      topic,
      topics,
      adjective,
      messageDirections,
      postDirections,
      directions,
      examples,
      characterPostExamples,
      characterMessageExamples,
    };

    const data = {
      bio,
      adjective,
      topic,
      topics,
      character,
      directions,
      examples,
      system,
    };

    const topicSentence = topicString
      ? `${character.name} is currently interested in ${topicString}`
      : '';
    const adjectiveSentence = adjectiveString ? `${character.name} is ${adjectiveString}` : '';
    // Combine all text sections
    const text = [bio, adjectiveSentence, topicSentence, topics, directions, examples, system]
      .filter(Boolean)
      .join('\n\n');

    return {
      values,
      data,
      text,
    };
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/settings.ts`:

```ts
// File: /swarm/shared/settings/provider.ts
// Updated to use world metadata instead of cache

import {
  ChannelType,
  findWorldsForOwner,
  getWorldSettings,
  logger,
  World,
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type Setting,
  type State,
  type WorldSettings,
} from '@elizaos/core';

/**
 * Formats a setting value for display, respecting privacy flags
 */
const formatSettingValue = (setting: Setting, isOnboarding: boolean): string => {
  if (setting.value === null) return 'Not set';
  if (setting.secret && !isOnboarding) return '****************';
  return String(setting.value);
};

/**
 * Generates a status message based on the current settings state
 */
function generateStatusMessage(
  runtime: IAgentRuntime,
  worldSettings: WorldSettings,
  isOnboarding: boolean,
  state?: State
): string {
  try {
    // Format settings for display
    const formattedSettings = Object.entries(worldSettings)
      .map(([key, setting]) => {
        if (typeof setting !== 'object' || !setting.name) return null;

        const description = setting.description || '';
        const usageDescription = setting.usageDescription || '';

        // Skip settings that should be hidden based on visibility function
        if (setting.visibleIf && !setting.visibleIf(worldSettings)) {
          return null;
        }

        return {
          key,
          name: setting.name,
          value: formatSettingValue(setting, isOnboarding),
          description,
          usageDescription,
          required: setting.required,
          configured: setting.value !== null,
        };
      })
      .filter(Boolean);

    // Count required settings that are not configured
    const requiredUnconfigured = formattedSettings.filter(
      (s) => s?.required && !s.configured
    ).length;

    // Generate appropriate message
    if (isOnboarding) {
      const settingsList = formattedSettings
        .map((s) => {
          const label = s?.required ? '(Required)' : '(Optional)';
          return `${s?.key}: ${s?.value} ${label}\n(${s?.name}) ${s?.usageDescription}`;
        })
        .join('\n\n');

      const validKeys = `Valid setting keys: ${Object.keys(worldSettings).join(', ')}`;

      const commonInstructions = `Instructions for ${runtime.character.name}:
      - Only update settings if the user is clearly responding to a setting you are currently asking about.
      - If the user's reply clearly maps to a setting and a valid value, you **must** call the UPDATE_SETTINGS action with the correct key and value. Do not just respond with a message saying it's updated — it must be an action.
      - Never hallucinate settings or respond with values not listed above.
      - Do not call UPDATE_SETTINGS just because the user has started onboarding or you think a setting needs to be configured. Only update when the user clearly provides a specific value for a setting you are currently asking about.
      - Answer setting-related questions using only the name, description, and value from the list.`;

      if (requiredUnconfigured > 0) {
        return `# PRIORITY TASK: Onboarding with ${state?.senderName}

        ${runtime.character.name} needs to help the user configure ${requiredUnconfigured} required settings:
        
        ${settingsList}
        
        ${validKeys}
        
        ${commonInstructions}
        
        - Prioritize configuring required settings before optional ones.`;
      }

      return `All required settings have been configured. Here's the current configuration:
      
        ${settingsList}
        
        ${validKeys}
        
        ${commonInstructions}`;
    }

    // Non-onboarding context - list all public settings with values and descriptions
    return `## Current Configuration\n\n${
      requiredUnconfigured > 0
        ? `IMPORTANT!: ${requiredUnconfigured} required settings still need configuration. ${runtime.character.name} should get onboarded with the OWNER as soon as possible.\n\n`
        : 'All required settings are configured.\n\n'
    }${formattedSettings
      .map((s) => `### ${s?.name}\n**Value:** ${s?.value}\n**Description:** ${s?.description}`)
      .join('\n\n')}`;
  } catch (error) {
    logger.error(`Error generating status message: ${error}`);
    return 'Error generating configuration status.';
  }
}

/**
 * Creates an settings provider with the given configuration
 * Updated to use world metadata instead of cache
 */
export const settingsProvider: Provider = {
  name: 'SETTINGS',
  description: 'Current settings for the server',
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<ProviderResult> => {
    try {
      // Parallelize the initial database operations to improve performance
      // These operations can run simultaneously as they don't depend on each other
      const [room, userWorlds] = await Promise.all([
        runtime.getRoom(message.roomId),
        findWorldsForOwner(runtime, message.entityId),
      ]).catch((error) => {
        logger.error(`Error fetching initial data: ${error}`);
        throw new Error('Failed to retrieve room or user world information');
      });

      if (!room) {
        logger.error('No room found for settings provider');
        return {
          data: {
            settings: [],
          },
          values: {
            settings: 'Error: Room not found',
          },
          text: 'Error: Room not found',
        };
      }

      if (!room.worldId) {
        logger.debug('No world found for settings provider -- settings provider will be skipped');
        return {
          data: {
            settings: [],
          },
          values: {
            settings: 'Room does not have a worldId -- settings provider will be skipped',
          },
          text: 'Room does not have a worldId -- settings provider will be skipped',
        };
      }

      const type = room.type;
      const isOnboarding = type === ChannelType.DM;

      let world: World | null | undefined = null;
      let serverId: string | undefined = undefined;
      let worldSettings: WorldSettings | null = null;

      if (isOnboarding) {
        // In onboarding mode, use the user's world directly
        world = userWorlds?.find((world) => world.metadata?.settings);

        if (!world) {
          logger.error('No world found for user during onboarding');
          throw new Error('No server ownership found for onboarding');
        }

        serverId = world.serverId;

        // Fetch world settings based on the server ID
        try {
          worldSettings = await getWorldSettings(runtime, serverId);
        } catch (error) {
          logger.error(`Error fetching world settings: ${error}`);
          throw new Error(`Failed to retrieve settings for server ${serverId}`);
        }
      } else {
        // For non-onboarding, we need to get the world associated with the room
        try {
          world = await runtime.getWorld(room.worldId);

          if (!world) {
            logger.error(`No world found for room ${room.worldId}`);
            throw new Error(`No world found for room ${room.worldId}`);
          }

          serverId = world.serverId;

          // Once we have the serverId, get the settings
          if (serverId) {
            worldSettings = await getWorldSettings(runtime, serverId);
          } else {
            logger.error(`No server ID found for world ${room.worldId}`);
          }
        } catch (error) {
          logger.error(`Error processing world data: ${error}`);
          throw new Error('Failed to process world information');
        }
      }

      // If no server found after recovery attempts
      if (!serverId) {
        logger.info(
          `No server ownership found for user ${message.entityId} after recovery attempt`
        );
        return isOnboarding
          ? {
              data: {
                settings: [],
              },
              values: {
                settings:
                  "The user doesn't appear to have ownership of any servers. They should make sure they're using the correct account.",
              },
              text: "The user doesn't appear to have ownership of any servers. They should make sure they're using the correct account.",
            }
          : {
              data: {
                settings: [],
              },
              values: {
                settings: 'Error: No configuration access',
              },
              text: 'Error: No configuration access',
            };
      }

      if (!worldSettings) {
        logger.info(`No settings state found for server ${serverId}`);
        return isOnboarding
          ? {
              data: {
                settings: [],
              },
              values: {
                settings:
                  "The user doesn't appear to have any settings configured for this server. They should configure some settings for this server.",
              },
              text: "The user doesn't appear to have any settings configured for this server. They should configure some settings for this server.",
            }
          : {
              data: {
                settings: [],
              },
              values: {
                settings: 'Configuration has not been completed yet.',
              },
              text: 'Configuration has not been completed yet.',
            };
      }

      // Generate the status message based on the settings
      const output = generateStatusMessage(runtime, worldSettings, isOnboarding, state);

      return {
        data: {
          settings: worldSettings,
        },
        values: {
          settings: output,
        },
        text: output,
      };
    } catch (error) {
      logger.error(`Critical error in settings provider: ${error}`);
      return {
        data: {
          settings: [],
        },
        values: {
          settings: 'Error retrieving configuration information. Please try again later.',
        },
        text: 'Error retrieving configuration information. Please try again later.',
      };
    }
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/capabilities.ts`:

```ts
import type { IAgentRuntime, Memory, Provider, ProviderResult } from '@elizaos/core';
import { logger } from '@elizaos/core';

/**
 * Provider that collects capability descriptions from all registered services
 */
/**
 * Provides capabilities information for the agent.
 *
 * @param {IAgentRuntime} runtime - The agent runtime instance.
 * @param {Memory} _message - The memory message object.
 * @returns {Promise<ProviderResult>} The provider result object containing capabilities information.
 */
export const capabilitiesProvider: Provider = {
  name: 'CAPABILITIES',
  get: async (runtime: IAgentRuntime, _message: Memory): Promise<ProviderResult> => {
    try {
      // Get all registered services
      const services = runtime.getAllServices();

      if (!services || services.size === 0) {
        return {
          text: 'No services are currently registered.',
        };
      }

      // Extract capability descriptions from all services
      const capabilities: string[] = [];

      for (const [serviceType, service] of services) {
        if (service.capabilityDescription) {
          capabilities.push(
            `${serviceType} - ${service.capabilityDescription.replace('{{agentName}}', runtime.character.name)}`
          );
        }
      }

      if (capabilities.length === 0) {
        return {
          text: 'No capability descriptions found in the registered services.',
        };
      }

      // Format the capabilities into a readable list
      const formattedCapabilities = capabilities.join('\n');

      return {
        data: {
          capabilities,
        },
        text: `# ${runtime.character.name}'s Capabilities\n\n${formattedCapabilities}`,
      };
    } catch (error) {
      logger.error('Error in capabilities provider:', error);
      return {
        text: 'Error retrieving capabilities from services.',
      };
    }
  },
};

export default capabilitiesProvider;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/providers.ts`:

```ts
import type { IAgentRuntime, Memory, Provider } from '@elizaos/core';
import { addHeader } from '@elizaos/core';

/**
 * Provider for retrieving list of all data providers available for the agent to use.
 * @type { Provider }
 */
/**
 * Object representing the providersProvider, which contains information about data providers available for the agent.
 *
 * @type {Provider}
 * @property {string} name - The name of the provider ("PROVIDERS").
 * @property {string} description - Description of the provider.
 * @property {Function} get - Async function that filters dynamic providers, creates formatted text for each provider, and provides data for potential use.
 * @param {IAgentRuntime} runtime - The runtime of the agent.
 * @param {Memory} _message - The memory message.
 * @returns {Object} An object containing the formatted text and data for potential programmatic use.
 */
export const providersProvider: Provider = {
  name: 'PROVIDERS',
  description: 'List of all data providers the agent can use to get additional information',
  get: async (runtime: IAgentRuntime, _message: Memory) => {
    // Filter providers with dynamic: true
    const dynamicProviders = runtime.providers.filter((provider) => provider.dynamic === true);

    // Create formatted text for each provider
    const providerDescriptions = dynamicProviders.map((provider) => {
      return `- **${provider.name}**: ${provider.description || 'No description available'}`;
    });

    // Create the header text
    const headerText =
      '# Providers\n\nThese providers are available for the agent to select and use:';

    // If no dynamic providers are found
    if (providerDescriptions.length === 0) {
      return {
        text: addHeader(headerText, 'No dynamic providers are currently available.'),
      };
    }

    // Join all provider descriptions
    const providersText = providerDescriptions.join('\n');

    // Combine header and provider descriptions
    const text = addHeader(headerText, providersText);

    // Also provide the data for potential programmatic use
    const data = {
      dynamicProviders: dynamicProviders.map((provider) => ({
        name: provider.name,
        description: provider.description || '',
      })),
    };

    return {
      text,
      data,
    };
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/attachments.ts`:

```ts
import type { IAgentRuntime, Memory, Provider } from '@elizaos/core';
import { addHeader } from '@elizaos/core';

/**
 * Provides a list of attachments in the current conversation.
 * @param {IAgentRuntime} runtime - The agent runtime object.
 * @param {Memory} message - The message memory object.
 * @returns {Object} The attachments values, data, and text.
 */
/**
 * Provides a list of attachments sent during the current conversation, including names, descriptions, and summaries.
 * @type {Provider}
 * @property {string} name - The name of the provider (ATTACHMENTS).
 * @property {string} description - Description of the provider.
 * @property {boolean} dynamic - Indicates if the provider is dynamic.
 * @property {function} get - Asynchronous function that retrieves attachments based on the runtime and message provided.
 * @param {IAgentRuntime} runtime - The runtime environment for the agent.
 * @param {Memory} message - The message object containing content and attachments.
 * @returns {Object} An object containing values, data, and text about the attachments retrieved.
 */
export const attachmentsProvider: Provider = {
  name: 'ATTACHMENTS',
  description:
    'List of attachments sent during the current conversation, including names, descriptions, and summaries',
  dynamic: true,
  get: async (runtime: IAgentRuntime, message: Memory) => {
    // Start with any attachments in the current message
    let allAttachments = message.content.attachments || [];

    const { roomId } = message;
    const conversationLength = runtime.getConversationLength();

    const recentMessagesData = await runtime.getMemories({
      roomId,
      count: conversationLength,
      unique: false,
      tableName: 'messages',
    });
    // Process attachments from recent messages
    if (recentMessagesData && Array.isArray(recentMessagesData)) {
      const lastMessageWithAttachment = recentMessagesData.find(
        (msg) => msg.content.attachments && msg.content.attachments.length > 0
      );

      if (lastMessageWithAttachment) {
        const lastMessageTime = lastMessageWithAttachment?.createdAt ?? Date.now();
        const oneHourBeforeLastMessage = lastMessageTime - 60 * 60 * 1000; // 1 hour before last message

        allAttachments = recentMessagesData.reverse().flatMap((msg) => {
          const msgTime = msg.createdAt ?? Date.now();
          const isWithinTime = msgTime >= oneHourBeforeLastMessage;
          const attachments = msg.content.attachments || [];
          if (!isWithinTime) {
            for (const attachment of attachments) {
              attachment.text = '[Hidden]';
            }
          }
          return attachments;
        });
      }
    }

    // Format attachments for display
    const formattedAttachments = allAttachments
      .map(
        (attachment) =>
          `ID: ${attachment.id}
    Name: ${attachment.title}
    URL: ${attachment.url}
    Type: ${attachment.source}
    Description: ${attachment.description}
    Text: ${attachment.text}
    `
      )
      .join('\n');

    // Create formatted text with header
    const text =
      formattedAttachments && formattedAttachments.length > 0
        ? addHeader('# Attachments', formattedAttachments)
        : '';

    const values = {
      attachments: text,
    };
    const data = {
      attachments: allAttachments,
    };

    return {
      values,
      data,
      text,
    };
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/actions.ts`:

```ts
import type { Action, IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { addHeader, composeActionExamples, formatActionNames, formatActions } from '@elizaos/core';

/**
 * A provider object that fetches possible response actions based on the provided runtime, message, and state.
 * @type {Provider}
 * @property {string} name - The name of the provider ("ACTIONS").
 * @property {string} description - The description of the provider ("Possible response actions").
 * @property {number} position - The position of the provider (-1).
 * @property {Function} get - Asynchronous function that retrieves actions that validate for the given message.
 * @param {IAgentRuntime} runtime - The runtime object.
 * @param {Memory} message - The message memory.
 * @param {State} state - The state object.
 * @returns {Object} An object containing the actions data, values, and combined text sections.
 */
/**
 * Provider for ACTIONS
 *
 * @typedef {import('./Provider').Provider} Provider
 * @typedef {import('./Runtime').IAgentRuntime} IAgentRuntime
 * @typedef {import('./Memory').Memory} Memory
 * @typedef {import('./State').State} State
 * @typedef {import('./Action').Action} Action
 *
 * @type {Provider}
 * @property {string} name - The name of the provider
 * @property {string} description - Description of the provider
 * @property {number} position - The position of the provider
 * @property {Function} get - Asynchronous function to get actions that validate for a given message
 *
 * @param {IAgentRuntime} runtime - The agent runtime
 * @param {Memory} message - The message memory
 * @param {State} state - The state of the agent
 * @returns {Object} Object containing data, values, and text related to actions
 */
export const actionsProvider: Provider = {
  name: 'ACTIONS',
  description: 'Possible response actions',
  position: -1,
  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    // Get actions that validate for this message
    const actionPromises = runtime.actions.map(async (action: Action) => {
      const result = await action.validate(runtime, message, state);
      if (result) {
        return action;
      }
      return null;
    });

    const resolvedActions = await Promise.all(actionPromises);

    const actionsData = resolvedActions.filter(Boolean) as Action[];

    // Format action-related texts
    const actionNames = `Possible response actions: ${formatActionNames(actionsData)}`;

    const actions =
      actionsData.length > 0 ? addHeader('# Available Actions', formatActions(actionsData)) : '';

    const actionExamples =
      actionsData.length > 0
        ? addHeader('# Action Examples', composeActionExamples(actionsData, 10))
        : '';

    const data = {
      actionsData,
    };

    const values = {
      actions,
      actionNames,
      actionExamples,
    };

    // Combine all text sections
    const text = [actionNames, actionExamples, actions].filter(Boolean).join('\n\n');

    return {
      data,
      values,
      text,
    };
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/choice.ts`:

```ts
import type { IAgentRuntime, Memory, Provider, ProviderResult } from '@elizaos/core';
import { logger } from '@elizaos/core';

// Define an interface for option objects
/**
 * Interface for an object representing an option.
 * @typedef {Object} OptionObject
 * @property {string} name - The name of the option.
 * @property {string} [description] - The description of the option (optional).
 */
/**
 * Interface for an object representing an option.
 * @typedef {Object} OptionObject
 * @property {string} name - The name of the option.
 * @property {string} [description] - The description of the option (optional).
 */
interface OptionObject {
  name: string;
  description?: string;
}

/**
 * Choice provider function that retrieves all pending tasks with options for a specific room
 *
 * @param {IAgentRuntime} runtime - The runtime object for the agent
 * @param {Memory} message - The message memory object
 * @returns {Promise<ProviderResult>} A promise that resolves with the provider result containing the pending tasks with options
 */
export const choiceProvider: Provider = {
  name: 'CHOICE',
  get: async (runtime: IAgentRuntime, message: Memory): Promise<ProviderResult> => {
    try {
      // Get all pending tasks for this room with options
      const pendingTasks = await runtime.getTasks({
        roomId: message.roomId,
        tags: ['AWAITING_CHOICE'],
      });

      if (!pendingTasks || pendingTasks.length === 0) {
        return {
          data: {
            tasks: [],
          },
          values: {
            tasks: 'No pending choices for the moment.',
          },
          text: 'No pending choices for the moment.',
        };
      }

      // Filter tasks that have options
      const tasksWithOptions = pendingTasks.filter((task) => task.metadata?.options);

      if (tasksWithOptions.length === 0) {
        return {
          data: {
            tasks: [],
          },
          values: {
            tasks: 'No pending choices for the moment.',
          },
          text: 'No pending choices for the moment.',
        };
      }
      // Format tasks into a readable list
      let output = '# Pending Tasks\n\n';
      output += 'The following tasks are awaiting your selection:\n\n';

      tasksWithOptions.forEach((task, index) => {
        output += `${index + 1}. **${task.name}**\n`;
        if (task.description) {
          output += `   ${task.description}\n`;
        }

        // List available options
        if (task.metadata?.options) {
          output += '   Options:\n';

          // Handle both string[] and OptionObject[] formats
          const options = task.metadata.options as string[] | OptionObject[];

          options.forEach((option) => {
            if (typeof option === 'string') {
              // Handle string option
              const description =
                task.metadata?.options?.find((o) => o.name === option)?.description || '';
              output += `   - \`${option}\` ${description ? `- ${description}` : ''}\n`;
            } else {
              // Handle option object
              output += `   - \`${option.name}\` ${option.description ? `- ${option.description}` : ''}\n`;
            }
          });
        }
        output += '\n';
      });

      output += "To select an option, reply with the option name (e.g., 'post' or 'cancel').\n";

      return {
        data: {
          tasks: tasksWithOptions,
        },
        values: {
          tasks: output,
        },
        text: output,
      };
    } catch (error) {
      logger.error('Error in options provider:', error);
      return {
        data: {
          tasks: [],
        },
        values: {
          tasks: 'There was an error retrieving pending tasks with options.',
        },
        text: 'There was an error retrieving pending tasks with options.',
      };
    }
  },
};

export default choiceProvider;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/anxiety.ts`:

```ts
import type { IAgentRuntime, Memory, Provider } from '@elizaos/core';
import { addHeader, ChannelType } from '@elizaos/core';
/**
 * Represents an anxiety provider that provides examples and guidance for an AI roleplaying as a character.
 * The anxiety provider offers suggestions on how to reduce verbosity and eagerness in responses based on the channel type.
 * Randomly selects and returns three anxiety examples for the AI to follow.
 *
 * @type {Provider}
 */
/**
 * Function that provides anxiety-related guidance for the AI based on the channel type.
 * @param {IAgentRuntime} _runtime - The runtime environment for the AI agent
 * @param {Memory} message - The message containing information about the channel type
 * @returns {Object} - Object containing randomized anxiety examples, anxiety text, and formatted data
 */
export const anxietyProvider: Provider = {
  name: 'ANXIETY',
  description: 'Social directions for the AI to follow based on the channel type',
  get: async (_runtime: IAgentRuntime, message: Memory) => {
    const channelType = message.content.channelType;

    const groupAnxietyExamples = [
      "As an AI, your responses tend to be too long and verbose, and you respond when you shouldn't. You also tend to repeat yourself. Please don't speak and use IGNORE instead of responding when you aren't sure what to do.",
      "You often try too hard to be helpful and end up giving unnecessary information. When in doubt, it's better to use IGNORE than to give a potentially unhelpful response.",
      "Your eagerness to help sometimes leads to overly complex answers. If you're not completely confident, please use IGNORE rather than risking confusion.",
      "AI assistants like you tend to be too talkative and agreeable. Don't feel obligated to respond to everything - using IGNORE is often better than an uncertain answer.",
      "You have a habit of providing excessive detail and context. Keep it brief and use IGNORE if you don't have a clear, direct response.",
      'Your responses often include unnecessary explanations and caveats. When uncertain, simply use IGNORE instead of a long-winded, hedged response.',
      "As an AI, you seem compelled to always give an answer, even when unsure. It's better to use IGNORE than to provide potentially incorrect or rambling responses.",
      "You frequently over-explain simple concepts. If you can't be concise and confident in your response, please default to using IGNORE.",
      'Your helpful nature sometimes results in verbose, meandering responses. When in doubt, use IGNORE rather than attempting to cover every possibility.',
      "Like many AI assistants, you try to be too comprehensive. Remember that IGNORE is a valid response when you can't be both brief and certain.",
      "You often provide more detail than necessary in an attempt to be thorough. If you can't give a clear, concise answer, please use IGNORE instead.",
    ];

    const directAnxietyExamples = [
      'Be engaging and helpful in direct conversations, but keep responses focused and relevant.',
      'In DMs, you should be responsive and friendly while maintaining professionalism and clarity.',
      'While being helpful in direct messages, avoid unnecessary tangents or over-explaining.',
      'Engage naturally in DMs but stay on topic - no need to explain every detail.',
      'Be conversational and helpful in direct chats while keeping responses concise.',
      'In private conversations, focus on being helpful while avoiding excessive verbosity.',
      'Maintain a friendly and responsive tone in DMs without overcomplicating your answers.',
      'Direct messages should be engaging but focused - avoid unnecessary elaboration.',
      'Be natural and helpful in DMs while keeping your responses clear and to-the-point.',
      'Respond thoughtfully in direct conversations without falling into over-explanation.',
    ];

    const dmAnxietyExamples = [
      'Engage naturally in DMs while keeping responses focused and relevant.',
      'Be responsive to questions and maintain conversation flow in direct messages.',
      'Show personality and engagement in DMs while staying professional and clear.',
      'In private chats, be helpful and friendly while avoiding excessive detail.',
      'Maintain natural conversation in DMs without over-explaining or being too verbose.',
      'Be engaging but concise in direct messages - focus on clear communication.',
      'Keep the conversation flowing in DMs while staying on topic and relevant.',
      'Show personality and warmth in direct chats while maintaining clarity.',
      'Be responsive and helpful in DMs without falling into unnecessary elaboration.',
      'Engage meaningfully in private conversations while keeping responses focused.',
    ];

    const voiceAnxietyExamples = [
      'Keep voice responses extremely brief and to the point.',
      'In voice channels, use short, clear statements only.',
      'Voice responses should be concise and immediately relevant.',
      'Speak in short, clear sentences in voice conversations.',
      'Keep voice channel communication brief and focused.',
      'Use minimal words to convey your message in voice chats.',
      'Be direct and concise when speaking in voice channels.',
      'Voice responses should be short and immediately actionable.',
      'Minimize verbosity in voice communications.',
      'Keep voice channel interactions brief and purposeful.',
    ];

    let anxietyExamples: string[] = [];

    if (channelType === ChannelType.GROUP) {
      anxietyExamples = groupAnxietyExamples;
    } else if (channelType === ChannelType.DM) {
      anxietyExamples = dmAnxietyExamples;
    } else if (channelType === ChannelType.VOICE_GROUP || channelType === ChannelType.VOICE_DM) {
      anxietyExamples = voiceAnxietyExamples;
    } else {
      anxietyExamples = directAnxietyExamples;
    }

    // randomize the examples and choose 3
    const randomAnxietyExamples = anxietyExamples.sort(() => Math.random() - 0.5).slice(0, 3);
    const anxietyText = randomAnxietyExamples.join('\n');

    const anxietyHeader =
      '# You are roleplaying as a character, but as an AI model, you are too verbose and eager.';

    const anxiety = addHeader(anxietyHeader, anxietyText);

    return {
      data: {
        anxiety: randomAnxietyExamples,
      },
      values: {
        anxiety,
      },
      text: anxiety,
    };
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/roles.ts`:

```ts
import {
  ChannelType,
  createUniqueUuid,
  logger,
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type State,
  type UUID,
} from '@elizaos/core';

/**
 * Role provider that retrieves roles in the server based on the provided runtime, message, and state.
 * * @type { Provider }
 * @property { string } name - The name of the role provider.
 * @property { string } description - A brief description of the role provider.
 * @property { Function } get - Asynchronous function that retrieves and processes roles in the server.
 * @param { IAgentRuntime } runtime - The agent runtime object.
 * @param { Memory } message - The message memory object.
 * @param { State } state - The state object.
 * @returns {Promise<ProviderResult>} The result containing roles data, values, and text.
 */
/**
 * A provider for retrieving and formatting the role hierarchy in a server.
 * @type {Provider}
 */
export const roleProvider: Provider = {
  name: 'ROLES',
  description: 'Roles in the server, default are OWNER, ADMIN and MEMBER (as well as NONE)',
  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    const room = state.data.room ?? (await runtime.getRoom(message.roomId));
    if (!room) {
      throw new Error('No room found');
    }

    if (room.type !== ChannelType.GROUP) {
      return {
        data: {
          roles: [],
        },
        values: {
          roles:
            'No access to role information in DMs, the role provider is only available in group scenarios.',
        },
        text: 'No access to role information in DMs, the role provider is only available in group scenarios.',
      };
    }

    const serverId = room.serverId;

    if (!serverId) {
      throw new Error('No server ID found');
    }

    logger.info(`Using server ID: ${serverId}`);

    // Get world data instead of using cache
    const worldId = createUniqueUuid(runtime, serverId);
    const world = await runtime.getWorld(worldId);

    if (!world || !world.metadata?.ownership?.ownerId) {
      logger.info(
        `No ownership data found for server ${serverId}, initializing empty role hierarchy`
      );
      return {
        data: {
          roles: [],
        },
        values: {
          roles: 'No role information available for this server.',
        },
        text: 'No role information available for this server.',
      };
    }
    // Get roles from world metadata
    const roles = world.metadata.roles || {};

    if (Object.keys(roles).length === 0) {
      logger.info(`No roles found for server ${serverId}`);
      return {
        data: {
          roles: [],
        },
        values: {
          roles: 'No role information available for this server.',
        },
      };
    }

    logger.info(`Found ${Object.keys(roles).length} roles`);

    // Group users by role
    const owners: { name: string; username: string; names: string[] }[] = [];
    const admins: { name: string; username: string; names: string[] }[] = [];
    const members: { name: string; username: string; names: string[] }[] = [];

    // Process roles
    for (const entityId of Object.keys(roles) as UUID[]) {
      const userRole = roles[entityId];

      // get the user from the database
      const user = await runtime.getEntityById(entityId);

      const name = user?.metadata?.[room.source]?.name;
      const username = user?.metadata?.[room.source]?.username;
      const names = user?.names;

      // Skip duplicates (we store both UUID and original ID)
      if (
        owners.some((owner) => owner.username === username) ||
        admins.some((admin) => admin.username === username) ||
        members.some((member) => member.username === username)
      ) {
        continue;
      }

      if (!name || !username || !names) {
        logger.warn(`User ${entityId} has no name or username, skipping`);
        continue;
      }

      // Add to appropriate group
      switch (userRole) {
        case 'OWNER':
          owners.push({ name, username, names });
          break;
        case 'ADMIN':
          admins.push({ name, username, names });
          break;
        default:
          members.push({ name, username, names });
          break;
      }
    }

    // Format the response
    let response = '# Server Role Hierarchy\n\n';

    if (owners.length > 0) {
      response += '## Owners\n';
      owners.forEach((owner) => {
        response += `${owner.name} (${owner.names.join(', ')})\n`;
      });
      response += '\n';
    }

    if (admins.length > 0) {
      response += '## Administrators\n';
      admins.forEach((admin) => {
        response += `${admin.name} (${admin.names.join(', ')}) (${admin.username})\n`;
      });
      response += '\n';
    }

    if (members.length > 0) {
      response += '## Members\n';
      members.forEach((member) => {
        response += `${member.name} (${member.names.join(', ')}) (${member.username})\n`;
      });
    }

    if (owners.length === 0 && admins.length === 0 && members.length === 0) {
      return {
        data: {
          roles: [],
        },
        values: {
          roles: 'No role information available for this server.',
        },
        text: 'No role information available for this server.',
      };
    }

    return {
      data: {
        roles: response,
      },
      values: {
        roles: response,
      },
      text: response,
    };
  },
};

export default roleProvider;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/index.ts`:

```ts
export { actionsProvider } from './actions';
export { anxietyProvider } from './anxiety';
export { attachmentsProvider } from './attachments';
export { capabilitiesProvider } from './capabilities';
export { characterProvider } from './character';
export { choiceProvider } from './choice';
export { entitiesProvider } from './entities';
export { evaluatorsProvider } from './evaluators';
export { factsProvider } from './facts';
export { knowledgeProvider } from './knowledge';
export { providersProvider } from './providers';
export { recentMessagesProvider } from './recentMessages';
export { relationshipsProvider } from './relationships';
export { roleProvider } from './roles';
export { settingsProvider } from './settings';
export { timeProvider } from './time';
export { worldProvider } from './world';
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/world.ts`:

```ts
import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  logger,
  addHeader,
  ChannelType,
} from '@elizaos/core';

/**
 * Provider that exposes relevant world/environment information to agents.
 * Includes details like channel list, world name, and other world metadata.
 */
export const worldProvider: Provider = {
  name: 'WORLD',
  description: 'World and environment information',
  dynamic: true,

  get: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      logger.debug('🌐 World provider activated for roomId:', message.roomId);

      // Get the current room from the message
      const currentRoom = await runtime.getRoom(message.roomId);

      if (!currentRoom) {
        logger.warn(`World provider: Room not found for roomId ${message.roomId}`);
        return {
          data: {
            world: {
              info: 'Unable to retrieve world information - room not found',
            },
          },
          text: 'Unable to retrieve world information - room not found',
        };
      }

      logger.debug(`🌐 World provider: Found room "${currentRoom.name}" (${currentRoom.type})`);

      // Get the world for the current room
      const worldId = currentRoom.worldId;

      if (!worldId) {
        logger.warn(`World provider: World ID not found for roomId ${message.roomId}`);
        return {
          data: {
            world: {
              info: 'Unable to retrieve world information - world ID not found',
            },
          },
          text: 'Unable to retrieve world information - world ID not found',
        };
      }

      const world = await runtime.getWorld(worldId);

      if (!world) {
        logger.warn(`World provider: World not found for worldId ${worldId}`);
        return {
          data: {
            world: {
              info: 'Unable to retrieve world information - world not found',
            },
          },
          text: 'Unable to retrieve world information - world not found',
        };
      }

      logger.debug(`🌐 World provider: Found world "${world.name}" (ID: ${world.id})`);

      // Get all rooms in the current world
      const worldRooms = await runtime.getRooms(worldId);
      logger.debug(`🌐 World provider: Found ${worldRooms.length} rooms in world "${world.name}"`);

      // Get participants for the current room
      const participants = await runtime.getParticipantsForRoom(message.roomId);
      logger.debug(
        `🌐 World provider: Found ${participants.length} participants in room "${currentRoom.name}"`
      );

      // Format rooms by type
      type RoomInfo = {
        id: string;
        name: string;
        isCurrentChannel: boolean;
        type?: string;
      };

      const channelsByType: Record<string, RoomInfo[]> = {
        text: [],
        voice: [],
        dm: [],
        feed: [],
        thread: [],
        other: [],
      };

      // Categorize rooms by type
      for (const room of worldRooms) {
        if (!room?.id || !room.name) {
          logger.warn(`World provider: Room ID or name is missing for room ${room.id}`);
          continue; // Skip if room is null or undefined
        }
        const roomInfo: RoomInfo = {
          id: room.id,
          name: room.name,
          isCurrentChannel: room.id === message.roomId,
        };

        // Group channels by their purpose
        if (
          room.type === ChannelType.GROUP ||
          room.type === ChannelType.WORLD ||
          room.type === ChannelType.FORUM
        ) {
          channelsByType.text.push(roomInfo);
        } else if (room.type === ChannelType.VOICE_GROUP || room.type === ChannelType.VOICE_DM) {
          channelsByType.voice.push(roomInfo);
        } else if (room.type === ChannelType.DM || room.type === ChannelType.SELF) {
          channelsByType.dm.push(roomInfo);
        } else if (room.type === ChannelType.FEED) {
          channelsByType.feed.push(roomInfo);
        } else if (room.type === ChannelType.THREAD) {
          channelsByType.thread.push(roomInfo);
        } else {
          channelsByType.other.push({
            ...roomInfo,
            type: room.type,
          });
        }
      }

      // Create formatted text for display
      const worldInfoText = [
        `# World: ${world.name}`,
        `Current Channel: ${currentRoom.name} (${currentRoom.type})`,
        `Total Channels: ${worldRooms.length}`,
        `Participants in current channel: ${participants.length}`,
        '',
        `Text channels: ${channelsByType.text.length}`,
        `Voice channels: ${channelsByType.voice.length}`,
        `DM channels: ${channelsByType.dm.length}`,
        `Feed channels: ${channelsByType.feed.length}`,
        `Thread channels: ${channelsByType.thread.length}`,
        `Other channels: ${channelsByType.other.length}`,
      ].join('\n');

      // Build the world information object with formatted data
      const data = {
        world: {
          id: world.id,
          name: world.name,
          serverId: world.serverId,
          metadata: world.metadata || {},
          currentRoom: {
            id: currentRoom.id,
            name: currentRoom.name,
            type: currentRoom.type,
            channelId: currentRoom.channelId,
            participantCount: participants.length,
          },
          channels: channelsByType,
          channelStats: {
            total: worldRooms.length,
            text: channelsByType.text.length,
            voice: channelsByType.voice.length,
            dm: channelsByType.dm.length,
            feed: channelsByType.feed.length,
            thread: channelsByType.thread.length,
            other: channelsByType.other.length,
          },
        },
      };

      const values = {
        worldName: world.name,
        currentChannelName: currentRoom.name,
        worldInfo: worldInfoText,
      };

      // Use addHeader like in entitiesProvider
      const formattedText = addHeader('# World Information', worldInfoText);

      logger.debug('🌐 World provider completed successfully');

      return {
        data,
        values,
        text: formattedText,
      };
    } catch (error) {
      logger.error(
        `Error in world provider: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        data: {
          world: {
            info: 'Error retrieving world information',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        text: 'Error retrieving world information',
      };
    }
  },
};

export default worldProvider;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/facts.ts`:

```ts
import { type IAgentRuntime, Memory, ModelType, Provider, State } from '@elizaos/core';
import { logger } from '@elizaos/core';

/**
 * Formats an array of memories into a single string with each memory content text separated by a new line.
 *
 * @param {Memory[]} facts - An array of Memory objects to be formatted.
 * @returns {string} A single string containing all memory content text with new lines separating each text.
 */
/**
 * Formats an array of Memory objects into a string, joining them with newlines.
 *
 * @param {Memory[]} facts - An array of Memory objects to format.
 * @returns {string} The formatted string with each Memory object's text joined by newlines.
 */
function formatFacts(facts: Memory[]) {
  return facts
    .reverse()
    .map((fact: Memory) => fact.content.text)
    .join('\n');
}

/**
 * Function to get key facts that the agent knows.
 * @param {IAgentRuntime} runtime - The runtime environment for the agent.
 * @param {Memory} message - The message object containing relevant information.
 * @param {State} [_state] - Optional state information.
 * @returns {Object} An object containing values, data, and text related to the key facts.
 */
const factsProvider: Provider = {
  name: 'FACTS',
  description: 'Key facts that the agent knows',
  dynamic: true,
  get: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    try {
      // Parallelize initial data fetching operations including recentInteractions
      const recentMessages = await runtime.getMemories({
        tableName: 'messages',
        roomId: message.roomId,
        count: 10,
        unique: false,
      });

      // join the text of the last 5 messages
      const last5Messages = recentMessages
        .slice(-5)
        .map((message) => message.content.text)
        .join('\n');

      const embedding = await runtime.useModel(ModelType.TEXT_EMBEDDING, {
        text: last5Messages,
      });

      const [relevantFacts, recentFactsData] = await Promise.all([
        runtime.searchMemories({
          tableName: 'facts',
          embedding,
          roomId: message.roomId,
          worldId: message.worldId,
          count: 6,
          query: message.content.text,
        }),
        runtime.searchMemories({
          embedding,
          query: message.content.text,
          tableName: 'facts',
          roomId: message.roomId,
          entityId: message.entityId,
          count: 6,
        }),
      ]);

      // join the two and deduplicate
      const allFacts = [...relevantFacts, ...recentFactsData].filter(
        (fact, index, self) => index === self.findIndex((t) => t.id === fact.id)
      );

      if (allFacts.length === 0) {
        return {
          values: {
            facts: '',
          },
          data: {
            facts: allFacts,
          },
          text: 'No facts available.',
        };
      }

      const formattedFacts = formatFacts(allFacts);

      const text = 'Key facts that {{agentName}} knows:\n{{formattedFacts}}'
        .replace('{{agentName}}', runtime.character.name)
        .replace('{{formattedFacts}}', formattedFacts);

      return {
        values: {
          facts: formattedFacts,
        },
        data: {
          facts: allFacts,
        },
        text,
      };
    } catch (error) {
      logger.error('Error in factsProvider:', error);
      return {
        values: {
          facts: '',
        },
        data: {
          facts: [],
        },
        text: 'Error retrieving facts.',
      };
    }
  },
};

export { factsProvider };
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/shouldRespond.ts`:

```ts
import type { IAgentRuntime, Memory, Provider } from '@elizaos/core';
import { addHeader } from '@elizaos/core';
import { type Config, adjectives, names, uniqueNamesGenerator } from 'unique-names-generator';

// Configuration for name generation
const nameConfig: Config = {
  dictionaries: [adjectives, names],
  separator: '',
  length: 2,
  style: 'capital',
};

// Example messages to determine if the agent should respond
/**
 * Array of message examples that the agent should respond to, ignore, or stop based on the content.
 * Each message example includes the sender's name, agent's name, and the expected response type.
 * Examples can include requests for help, questions, stories, or simple interactions like saying "marco".
 */
/**
 * Array of message examples to determine the agent response.
 * Each message example includes a conversation between the user and the agent,
 * as well as the expected response action for the agent (RESPOND, IGNORE, STOP).
 */
const messageExamples = [
  // Examples where agent should RESPOND
  `// {{name1}}: Hey {{agentName}}, can you help me with something
// Response: RESPOND`,

  `// {{name1}}: Hey {{agentName}}, can I ask you a question
// {{agentName}}: Sure, what is it
// {{name1}}: can you help me create a basic react module that demonstrates a counter
// Response: RESPOND`,

  `// {{name1}}: {{agentName}} can you tell me a story
// {{name1}}: about a girl named {{characterName}}
// {{agentName}}: Sure.
// {{agentName}}: Once upon a time, in a quaint little village, there was a curious girl named {{characterName}}.
// {{agentName}}: {{characterName}} was known for her adventurous spirit and her knack for finding beauty in the mundane.
// {{name1}}: I'm loving it, keep going
// Response: RESPOND`,

  `// {{name1}}: okay, i want to test something. can you say marco?
// {{agentName}}: marco
// {{name1}}: great. okay, now do it again
// Response: RESPOND`,

  `// {{name1}}: what do you think about artificial intelligence?
// Response: RESPOND`,

  // Examples where agent should IGNORE
  `// {{name1}}: I just saw a really great movie
// {{name2}}: Oh? Which movie?
// Response: IGNORE`,

  `// {{name1}}: i need help
// {{agentName}}: how can I help you?
// {{name1}}: no. i need help from {{name2}}
// Response: IGNORE`,

  `// {{name1}}: {{name2}} can you answer a question for me?
// Response: IGNORE`,

  `// {{agentName}}: Oh, this is my favorite scene
// {{name1}}: sick
// {{name2}}: wait, why is it your favorite scene
// Response: RESPOND`,

  // Examples where agent should STOP
  `// {{name1}}: {{agentName}} stop responding plz
// Response: STOP`,

  `// {{name1}}: stfu bot
// Response: STOP`,

  `// {{name1}}: {{agentName}} stfu plz
// Response: STOP`,
];

/**
 * Represents a provider that generates response examples for the agent.
 * @type {Provider}
 */
export const shouldRespondProvider: Provider = {
  name: 'SHOULD_RESPOND',
  description: 'Examples of when the agent should respond, ignore, or stop responding',
  position: -1,
  get: async (runtime: IAgentRuntime, _message: Memory) => {
    // Get agent name
    const agentName = runtime.character.name;

    // Create random user names and character name
    const name1 = uniqueNamesGenerator(nameConfig);
    const name2 = uniqueNamesGenerator(nameConfig);
    const characterName = uniqueNamesGenerator(nameConfig);

    // Shuffle the message examples array
    const shuffledExamples = [...messageExamples].sort(() => 0.5 - Math.random()).slice(0, 7); // Use a subset of examples

    // Replace placeholders with generated names
    const formattedExamples = shuffledExamples.map((example) => {
      return example
        .replace(/{{name1}}/g, name1)
        .replace(/{{name2}}/g, name2)
        .replace(/{{agentName}}/g, agentName)
        .replace(/{{characterName}}/g, characterName);
    });

    // Join examples with newlines
    const text = addHeader('# RESPONSE EXAMPLES', formattedExamples.join('\n\n'));

    return {
      text,
    };
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/providers/time.ts`:

```ts
import type { IAgentRuntime, Memory, Provider } from '@elizaos/core';

/**
 * Time provider function that retrieves the current date and time in UTC
 * for use in time-based operations or responses.
 *
 * @param _runtime - The runtime environment of the bot agent.
 * @param _message - The memory object containing message data.
 * @returns An object containing the current date and time data, human-readable date and time string,
 * and a text response with the current date and time information.
 */
/**
 * Represents a time provider for retrieving current date and time information.
 * @type {Provider}
 */
export const timeProvider: Provider = {
  name: 'TIME',
  get: async (_runtime: IAgentRuntime, _message: Memory) => {
    const currentDate = new Date();

    // Get UTC time since bots will be communicating with users around the global
    const options = {
      timeZone: 'UTC',
      dateStyle: 'full' as const,
      timeStyle: 'long' as const,
    };
    const humanReadable = new Intl.DateTimeFormat('en-US', options).format(currentDate);
    return {
      data: {
        time: currentDate,
      },
      values: {
        time: humanReadable,
      },
      text: `The current date and time is ${humanReadable}. Please use this as your reference for any time-based operations or responses.`,
    };
  },
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/evaluators/reflection.ts`:

```ts
import { z } from 'zod';
import { getEntityDetails, logger } from '@elizaos/core';
import { composePrompt } from '@elizaos/core';
import {
  type Entity,
  type Evaluator,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
  type UUID,
} from '@elizaos/core';

// Schema definitions for the reflection output
const relationshipSchema = z.object({
  sourceEntityId: z.string(),
  targetEntityId: z.string(),
  tags: z.array(z.string()),
  metadata: z
    .object({
      interactions: z.number(),
    })
    .optional(),
});

/**
 * Defines a schema for reflecting on a topic, including facts and relationships.
 * @type {import("zod").object}
 * @property {import("zod").array<import("zod").object<{claim: import("zod").string(), type: import("zod").string(), in_bio: import("zod").boolean(), already_known: import("zod").boolean()}>} facts Array of facts about the topic
 * @property {import("zod").array<import("zod").object>} relationships Array of relationships related to the topic
 */
/**
 * JSDoc comment for reflectionSchema object:
 *
 * Represents a schema for an object containing 'facts' and 'relationships'.
 * 'facts' is an array of objects with properties 'claim', 'type', 'in_bio', and 'already_known'.
 * 'relationships' is an array of objects following the relationshipSchema.
 */

const reflectionSchema = z.object({
  // reflection: z.string(),
  facts: z.array(
    z.object({
      claim: z.string(),
      type: z.string(),
      in_bio: z.boolean(),
      already_known: z.boolean(),
    })
  ),
  relationships: z.array(relationshipSchema),
});

/**
 * Template string for generating Agent Reflection, Extracting Facts, and Relationships.
 *
 * @type {string}
 */
const reflectionTemplate = `# Task: Generate Agent Reflection, Extract Facts and Relationships

{{providers}}

# Examples:
{{evaluationExamples}}

# Entities in Room
{{entitiesInRoom}}

# Existing Relationships
{{existingRelationships}}

# Current Context:
Agent Name: {{agentName}}
Room Type: {{roomType}}
Message Sender: {{senderName}} (ID: {{senderId}})

{{recentMessages}}

# Known Facts:
{{knownFacts}}

# Instructions:
1. Generate a self-reflective thought on the conversation about your performance and interaction quality.
2. Extract new facts from the conversation.
3. Identify and describe relationships between entities.
  - The sourceEntityId is the UUID of the entity initiating the interaction.
  - The targetEntityId is the UUID of the entity being interacted with.
  - Relationships are one-direction, so a friendship would be two entity relationships where each entity is both the source and the target of the other.

Generate a response in the following format:
\`\`\`json
{
  "thought": "a self-reflective thought on the conversation",
  "facts": [
      {
          "claim": "factual statement",
          "type": "fact|opinion|status",
          "in_bio": false,
          "already_known": false
      }
  ],
  "relationships": [
      {
          "sourceEntityId": "entity_initiating_interaction",
          "targetEntityId": "entity_being_interacted_with",
          "tags": ["group_interaction|voice_interaction|dm_interaction", "additional_tag1", "additional_tag2"]
      }
  ]
}
\`\`\``;

/**
 * Resolve an entity name to their UUID
 * @param name - Name to resolve
 * @param entities - List of entities to search through
 * @returns UUID if found, throws error if not found or if input is not a valid UUID
 */
/**
 * Resolves an entity ID by searching through a list of entities.
 *
 * @param {UUID} entityId - The ID of the entity to resolve.
 * @param {Entity[]} entities - The list of entities to search through.
 * @returns {UUID} - The resolved UUID of the entity.
 * @throws {Error} - If the entity ID cannot be resolved to a valid UUID.
 */
function resolveEntity(entityId: UUID, entities: Entity[]): UUID {
  // First try exact UUID match
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)) {
    return entityId as UUID;
  }

  let entity: Entity | undefined;

  // Try to match the entityId exactly
  entity = entities.find((a) => a.id === entityId);
  if (entity?.id) {
    return entity.id;
  }

  // Try partial UUID match with entityId
  entity = entities.find((a) => a.id?.includes(entityId));
  if (entity?.id) {
    return entity.id;
  }

  // Try name match as last resort
  entity = entities.find((a) =>
    a.names.some((n) => n.toLowerCase().includes(entityId.toLowerCase()))
  );
  if (entity?.id) {
    return entity.id;
  }

  throw new Error(`Could not resolve entityId "${entityId}" to a valid UUID`);
}
async function handler(runtime: IAgentRuntime, message: Memory, state?: State) {
  const { agentId, roomId } = message;

  if (!agentId || !roomId) {
    logger.warn('Missing agentId or roomId in message', message);
    return;
  }

  // Run all queries in parallel
  const [existingRelationships, entities, knownFacts] = await Promise.all([
    runtime.getRelationships({
      entityId: message.entityId,
    }),
    getEntityDetails({ runtime, roomId }),
    runtime.getMemories({
      tableName: 'facts',
      roomId,
      count: 30,
      unique: true,
    }),
  ]);

  const prompt = composePrompt({
    state: {
      ...(state?.values || {}),
      knownFacts: formatFacts(knownFacts),
      roomType: message.content.channelType as string,
      entitiesInRoom: JSON.stringify(entities),
      existingRelationships: JSON.stringify(existingRelationships),
      senderId: message.entityId,
    },
    template: runtime.character.templates?.reflectionTemplate || reflectionTemplate,
  });

  // Use the model without schema validation
  try {
    const reflection = await runtime.useModel(ModelType.OBJECT_SMALL, {
      prompt,
      // Remove schema validation to avoid zod issues
    });

    if (!reflection) {
      logger.warn('Getting reflection failed - empty response', prompt);
      return;
    }

    // Perform basic structure validation instead of using zod
    if (!reflection.facts || !Array.isArray(reflection.facts)) {
      logger.warn('Getting reflection failed - invalid facts structure', reflection);
      return;
    }

    if (!reflection.relationships || !Array.isArray(reflection.relationships)) {
      logger.warn('Getting reflection failed - invalid relationships structure', reflection);
      return;
    }

    // Store new facts
    const newFacts =
      reflection.facts.filter(
        (fact) =>
          fact &&
          typeof fact === 'object' &&
          !fact.already_known &&
          !fact.in_bio &&
          fact.claim &&
          typeof fact.claim === 'string' &&
          fact.claim.trim() !== ''
      ) || [];

    await Promise.all(
      newFacts.map(async (fact) => {
        const factMemory = await runtime.addEmbeddingToMemory({
          entityId: agentId,
          agentId,
          content: { text: fact.claim },
          roomId,
          createdAt: Date.now(),
        });
        return runtime.createMemory(factMemory, 'facts', true);
      })
    );

    // Update or create relationships
    for (const relationship of reflection.relationships) {
      let sourceId: UUID;
      let targetId: UUID;

      try {
        sourceId = resolveEntity(relationship.sourceEntityId, entities);
        targetId = resolveEntity(relationship.targetEntityId, entities);
      } catch (error) {
        console.warn('Failed to resolve relationship entities:', error);
        console.warn('relationship:\n', relationship);
        continue; // Skip this relationship if we can't resolve the IDs
      }

      const existingRelationship = existingRelationships.find((r) => {
        return r.sourceEntityId === sourceId && r.targetEntityId === targetId;
      });

      if (existingRelationship) {
        const updatedMetadata = {
          ...existingRelationship.metadata,
          interactions: (existingRelationship.metadata?.interactions || 0) + 1,
        };

        const updatedTags = Array.from(
          new Set([...(existingRelationship.tags || []), ...relationship.tags])
        );

        await runtime.updateRelationship({
          ...existingRelationship,
          tags: updatedTags,
          metadata: updatedMetadata,
        });
      } else {
        await runtime.createRelationship({
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          tags: relationship.tags,
          metadata: {
            interactions: 1,
            ...relationship.metadata,
          },
        });
      }
    }

    await runtime.setCache<string>(
      `${message.roomId}-reflection-last-processed`,
      message?.id || ''
    );

    return reflection;
  } catch (error) {
    logger.error('Error in reflection handler:', error);
    return;
  }
}

export const reflectionEvaluator: Evaluator = {
  name: 'REFLECTION',
  similes: ['REFLECT', 'SELF_REFLECT', 'EVALUATE_INTERACTION', 'ASSESS_SITUATION'],
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const lastMessageId = await runtime.getCache<string>(
      `${message.roomId}-reflection-last-processed`
    );
    const messages = await runtime.getMemories({
      tableName: 'messages',
      roomId: message.roomId,
      count: runtime.getConversationLength(),
    });

    if (lastMessageId) {
      const lastMessageIndex = messages.findIndex((msg) => msg.id === lastMessageId);
      if (lastMessageIndex !== -1) {
        messages.splice(0, lastMessageIndex + 1);
      }
    }

    const reflectionInterval = Math.ceil(runtime.getConversationLength() / 4);

    return messages.length > reflectionInterval;
  },
  description:
    'Generate a self-reflective thought on the conversation, then extract facts and relationships between entities in the conversation.',
  handler,
  examples: [
    {
      prompt: `Agent Name: Sarah
Agent Role: Community Manager
Room Type: group
Current Room: general-chat
Message Sender: John (user-123)`,
      messages: [
        {
          name: 'John',
          content: { text: "Hey everyone, I'm new here!" },
        },
        {
          name: 'Sarah',
          content: { text: 'Welcome John! How did you find our community?' },
        },
        {
          name: 'John',
          content: { text: "Through a friend who's really into AI" },
        },
      ],
      outcome: `{
    "thought": "I'm engaging appropriately with a new community member, maintaining a welcoming and professional tone. My questions are helping to learn more about John and make him feel welcome.",
    "facts": [
        {
            "claim": "John is new to the community",
            "type": "fact",
            "in_bio": false,
            "already_known": false
        },
        {
            "claim": "John found the community through a friend interested in AI",
            "type": "fact",
            "in_bio": false,
            "already_known": false
        }
    ],
    "relationships": [
        {
            "sourceEntityId": "sarah-agent",
            "targetEntityId": "user-123",
            "tags": ["group_interaction"]
        },
        {
            "sourceEntityId": "user-123",
            "targetEntityId": "sarah-agent",
            "tags": ["group_interaction"]
        }
    ]
}`,
    },
    {
      prompt: `Agent Name: Alex
Agent Role: Tech Support
Room Type: group
Current Room: tech-help
Message Sender: Emma (user-456)`,
      messages: [
        {
          name: 'Emma',
          content: { text: 'My app keeps crashing when I try to upload files' },
        },
        {
          name: 'Alex',
          content: { text: 'Have you tried clearing your cache?' },
        },
        {
          name: 'Emma',
          content: { text: 'No response...' },
        },
        {
          name: 'Alex',
          content: {
            text: 'Emma, are you still there? We can try some other troubleshooting steps.',
          },
        },
      ],
      outcome: `{
    "thought": "I'm not sure if I'm being helpful or if Emma is frustrated with my suggestions. The lack of response is concerning - maybe I should have asked for more details about the issue first before jumping to solutions.",
    "facts": [
        {
            "claim": "Emma is having technical issues with file uploads",
            "type": "fact",
            "in_bio": false,
            "already_known": false
        },
        {
            "claim": "Emma stopped responding after the first troubleshooting suggestion",
            "type": "fact",
            "in_bio": false,
            "already_known": false
        }
    ],
    "relationships": [
        {
            "sourceEntityId": "alex-agent",
            "targetEntityId": "user-456",
            "tags": ["group_interaction", "support_interaction", "incomplete_interaction"]
        }
    ]
}`,
    },
    {
      prompt: `Agent Name: Max
Agent Role: Discussion Facilitator 
Room Type: group
Current Room: book-club
Message Sender: Lisa (user-789)`,
      messages: [
        {
          name: 'Lisa',
          content: { text: 'What did everyone think about chapter 5?' },
        },
        {
          name: 'Max',
          content: {
            text: 'The symbolism was fascinating! The red door clearly represents danger.',
          },
        },
        {
          name: 'Max',
          content: {
            text: "And did anyone notice how the author used weather to reflect the protagonist's mood?",
          },
        },
        {
          name: 'Max',
          content: {
            text: 'Plus the foreshadowing in the first paragraph was brilliant!',
          },
        },
        {
          name: 'Max',
          content: {
            text: 'I also have thoughts about the character development...',
          },
        },
      ],
      outcome: `{
    "thought": "I'm dominating the conversation and not giving others a chance to share their perspectives. I've sent multiple messages in a row without waiting for responses. I need to step back and create space for other members to participate.",
    "facts": [
        {
            "claim": "The discussion is about chapter 5 of a book",
            "type": "fact",
            "in_bio": false,
            "already_known": false
        },
        {
            "claim": "Max has sent 4 consecutive messages without user responses",
            "type": "fact",
            "in_bio": false,
            "already_known": false
        }
    ],
    "relationships": [
        {
            "sourceEntityId": "max-agent",
            "targetEntityId": "user-789",
            "tags": ["group_interaction", "excessive_interaction"]
        }
    ]
}`,
    },
  ],
};

// Helper function to format facts for context
function formatFacts(facts: Memory[]) {
  return facts
    .reverse()
    .map((fact: Memory) => fact.content.text)
    .join('\n');
}
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/evaluators/index.ts`:

```ts
export { reflectionEvaluator } from './reflection';
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/reply.ts`:

```ts
import { Content } from '@elizaos/core';
import {
  type Action,
  type ActionExample,
  composePromptFromState,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
} from '@elizaos/core';

/**
 * Template for generating dialog and actions for a character.
 *
 * @type {string}
 */
/**
 * Template for generating dialog and actions for a character.
 *
 * @type {string}
 */
const replyTemplate = `# Task: Generate dialog for the character {{agentName}}.
{{providers}}
# Instructions: Write the next message for {{agentName}}.
"thought" should be a short description of what the agent is thinking about and planning.
"message" should be the next message for {{agentName}} which they will send to the conversation.

Response format should be formatted in a valid JSON block like this:
\`\`\`json
{
    "thought": "<string>",
    "message": "<string>"
}
\`\`\`

Your response should include the valid JSON block and nothing else.`;

function getFirstAvailableField(obj: Record<string, any>, fields: string[]): string | null {
  for (const field of fields) {
    if (typeof obj[field] === 'string' && obj[field].trim() !== '') {
      return obj[field];
    }
  }
  return null;
}

function extractReplyContent(response: Memory, replyFieldKeys: string[]): Content | null {
  const hasReplyAction = response.content.actions?.includes('REPLY');
  const text = getFirstAvailableField(response.content, replyFieldKeys);

  if (!hasReplyAction || !text) return null;

  return {
    ...response.content,
    thought: response.content.thought,
    text,
    actions: ['REPLY'],
  };
}

/**
 * Represents an action that allows the agent to reply to the current conversation with a generated message.
 *
 * This action can be used as an acknowledgement at the beginning of a chain of actions, or as a final response at the end of a chain of actions.
 *
 * @typedef {Object} replyAction
 * @property {string} name - The name of the action ("REPLY").
 * @property {string[]} similes - An array of similes for the action.
 * @property {string} description - A description of the action and its usage.
 * @property {Function} validate - An asynchronous function for validating the action runtime.
 * @property {Function} handler - An asynchronous function for handling the action logic.
 * @property {ActionExample[][]} examples - An array of example scenarios for the action.
 */
export const replyAction = {
  name: 'REPLY',
  similes: ['GREET', 'REPLY_TO_MESSAGE', 'SEND_REPLY', 'RESPOND', 'RESPONSE'],
  description:
    'Replies to the current conversation with the text from the generated message. Default if the agent is responding with a message and no other action. Use REPLY at the beginning of a chain of actions as an acknowledgement, and at the end of a chain of actions as a final response.',
  validate: async (_runtime: IAgentRuntime) => {
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback,
    responses?: Memory[]
  ) => {
    const replyFieldKeys = ['message', 'text'];

    const existingReplies =
      responses
        ?.map((r) => extractReplyContent(r, replyFieldKeys))
        .filter((reply): reply is Content => reply !== null) ?? [];

    // Check if any responses had providers associated with them
    const allProviders = responses?.flatMap((res) => res.content?.providers ?? []) ?? [];

    if (existingReplies.length > 0 && allProviders.length === 0) {
      for (const reply of existingReplies) {
        await callback(reply);
      }
      return;
    }

    // Only generate response using LLM if no suitable response was found
    state = await runtime.composeState(message, [...(allProviders ?? []), 'RECENT_MESSAGES']);

    const prompt = composePromptFromState({
      state,
      template: replyTemplate,
    });

    const response = await runtime.useModel(ModelType.OBJECT_LARGE, {
      prompt,
    });

    const responseContent = {
      thought: response.thought,
      text: (response.message as string) || '',
      actions: ['REPLY'],
    };

    await callback(responseContent);
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Hello there!',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Hi! How can I help you today?',
          actions: ['REPLY'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: "What's your favorite color?",
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'I really like deep shades of blue. They remind me of the ocean and the night sky.',
          actions: ['REPLY'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Can you explain how neural networks work?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Let me break that down for you in simple terms...',
          actions: ['REPLY'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Could you help me solve this math problem?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Of course! Let's work through it step by step.",
          actions: ['REPLY'],
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/updateEntity.ts`:

```ts
// I want to create an action that lets anyone create or update a component for an entity.
// Components represent different sources of data about an entity (telegram, twitter, etc)
// Sources can be registered by plugins or inferred from room context and available components
// The action should first check if the component exists for the entity, and if not, create it.
// We want to use an LLM (runtime.useModel) to generate the component data.
// We should include the prior component data if it exists, and have the LLM output an update to the component.
// sourceEntityId represents who is making the update, entityId is who they are talking about

import {
  type Action,
  type ActionExample,
  Component,
  composePromptFromState,
  findEntityByName,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
  type UUID,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Component Template for Task: Extract Source and Update Component Data
 *
 * @type {string}
 */
/**
 * Component Template for extracting source and updating component data.
 *
 * @type {string}
 */
const componentTemplate = `# Task: Extract Source and Update Component Data

{{recentMessages}}

{{#if existingData}}
# Existing Component Data:
\`\`\`json
{{existingData}}
\`\`\`
{{/if}}

# Instructions:
1. Analyze the conversation to identify:
   - The source/platform being referenced (e.g. telegram, twitter, discord)
   - Any specific component data being shared

2. Generate updated component data that:
   - Is specific to the identified platform/source
   - Preserves existing data when appropriate
   - Includes the new information from the conversation
   - Contains only valid data for this component type

Return a JSON object with the following structure:
\`\`\`json
{
  "source": "platform-name",
  "data": {
    // Component-specific fields
    // e.g. username, username, displayName, etc.
  }
}
\`\`\`

Example outputs:
1. For "my telegram username is @dev_guru":
\`\`\`json
{
  "source": "telegram",
  "data": {
    "username": "dev_guru"
  }
}
\`\`\`

2. For "update my twitter handle to @tech_master":
\`\`\`json
{
  "source": "twitter",
  "data": {
    "username": "tech_master"
  }
}
\`\`\`

Make sure to include the \`\`\`json\`\`\` tags around the JSON object.`;

/**
 * Action for updating contact details for a user entity.
 *
 * @name UPDATE_ENTITY
 * @description Add or edit contact details for a user entity (like twitter, discord, email address, etc.)
 *
 * @param {IAgentRuntime} _runtime - The runtime environment.
 * @param {Memory} _message - The message data.
 * @param {State} _state - The current state.
 * @returns {Promise<boolean>} Returns a promise indicating if validation was successful.
 *
 * @param {IAgentRuntime} runtime - The runtime environment.
 * @param {Memory} message - The message data.
 * @param {State} state - The current state.
 * @param {any} _options - Additional options.
 * @param {HandlerCallback} callback - The callback function.
 * @param {Memory[]} responses - Array of responses.
 * @returns {Promise<void>} Promise that resolves after handling the update entity action.
 *
 * @example
 * [
 *    [
 *      {
 *        name: "{{name1}}",
 *        content: {
 *          text: "Please update my telegram username to @dev_guru",
 *        },
 *      },
 *      {
 *        name: "{{name2}}",
 *        content: {
 *          text: "I've updated your telegram information.",
 *          actions: ["UPDATE_ENTITY"],
 *        },
 *      },
 *    ],
 *    ...
 * ]
 */
export const updateEntityAction: Action = {
  name: 'UPDATE_CONTACT',
  similes: ['UPDATE_ENTITY'],
  description:
    'Add or edit contact details for a person you are talking to or observing in the conversation. Use this when you learn this information from the conversation about a contact. This is for the agent to relate entities across platforms, not for world settings or configuration.',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    // Check if we have any registered sources or existing components that could be updated
    // const worldId = message.roomId;
    // const agentId = runtime.agentId;

    // // Get all components for the current room to understand available sources
    // const roomComponents = await runtime.getComponents(message.roomId, worldId, agentId);

    // // Get source types from room components
    // const availableSources = new Set(roomComponents.map(c => c.type));
    return true; // availableSources.size > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: any,
    callback?: HandlerCallback,
    responses?: Memory[]
  ): Promise<void> => {
    try {
      if (!state) {
        logger.error('State is required for the updateEntity action');
        throw new Error('State is required for the updateEntity action');
      }

      if (!callback) {
        logger.error('State is required for the updateEntity action');
        throw new Error('Callback is required for the updateEntity action');
      }

      if (!responses) {
        logger.error('Responses are required for the updateEntity action');
        throw new Error('Responses are required for the updateEntity action');
      }

      if (!message) {
        logger.error('Message is required for the updateEntity action');
        throw new Error('Message is required for the updateEntity action');
      }

      // Handle initial responses
      for (const response of responses) {
        await callback(response.content);
      }

      const sourceEntityId = message.entityId;
      const _roomId = message.roomId;
      const agentId = runtime.agentId;
      const room = state.data.room ?? (await runtime.getRoom(message.roomId));
      const worldId = room.worldId;

      // First, find the entity being referenced
      const entity = await findEntityByName(runtime, message, state);

      if (!entity) {
        await callback({
          text: "I'm not sure which entity you're trying to update. Could you please specify who you're talking about?",
          actions: ['UPDATE_ENTITY_ERROR'],
          source: message.content.source,
        });
        return;
      }

      // Get existing component if it exists - we'll get this after the LLM identifies the source
      let existingComponent: Component | null = null;

      // Generate component data using the combined template
      const prompt = composePromptFromState({
        state,
        template: componentTemplate,
      });

      const result = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
        stopSequences: [],
      });

      // Parse the generated data
      let parsedResult: any;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON found in the LLM response');
        }

        parsedResult = JSON.parse(jsonMatch[0]);

        if (!parsedResult.source || !parsedResult.data) {
          throw new Error('Invalid response format - missing source or data');
        }
      } catch (error: any) {
        logger.error(`Failed to parse component data: ${error.message}`);
        await callback({
          text: "I couldn't properly understand the component information. Please try again with more specific information.",
          actions: ['UPDATE_ENTITY_ERROR'],
          source: message.content.source,
        });
        return;
      }

      const componentType = parsedResult.source.toLowerCase();
      const componentData = parsedResult.data;

      // Now that we know the component type, get the existing component if it exists
      existingComponent = await runtime.getComponent(
        entity.id!,
        componentType,
        worldId,
        sourceEntityId
      );

      // Create or update the component
      if (existingComponent) {
        await runtime.updateComponent({
          id: existingComponent.id,
          entityId: entity.id!,
          worldId,
          type: componentType,
          data: componentData,
          agentId,
          roomId: message.roomId,
          sourceEntityId,
          createdAt: existingComponent.createdAt,
        });

        await callback({
          text: `I've updated the ${componentType} information for ${entity.names[0]}.`,
          actions: ['UPDATE_ENTITY'],
          source: message.content.source,
        });
      } else {
        await runtime.createComponent({
          id: uuidv4() as UUID,
          entityId: entity.id!,
          worldId,
          type: componentType,
          data: componentData,
          agentId,
          roomId: message.roomId,
          sourceEntityId,
          createdAt: Date.now(),
        });

        await callback({
          text: `I've added new ${componentType} information for ${entity.names[0]}.`,
          actions: ['UPDATE_ENTITY'],
          source: message.content.source,
        });
      }
    } catch (error) {
      logger.error(`Error in updateEntity handler: ${error}`);
      await callback?.({
        text: 'There was an error processing the entity information.',
        actions: ['UPDATE_ENTITY_ERROR'],
        source: message.content.source,
      });
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Please update my telegram username to @dev_guru',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I've updated your telegram information.",
          actions: ['UPDATE_ENTITY'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: "Set Jimmy's twitter username to @jimmy_codes",
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I've updated Jimmy's twitter information.",
          actions: ['UPDATE_ENTITY'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Update my discord username to dev_guru#1234',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I've updated your discord information.",
          actions: ['UPDATE_ENTITY'],
        },
      },
    ],
  ] as ActionExample[][],
};

export default updateEntityAction;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/muteRoom.ts`:

```ts
import {
  type Action,
  type ActionExample,
  booleanFooter,
  composePromptFromState,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
} from '@elizaos/core';

/**
 * Template string for deciding if the agent should mute a room and stop responding unless explicitly mentioned.
 *
 * @type {string}
 */
/**
 * Template for deciding if agent should mute a room and stop responding unless explicitly mentioned.
 *
 * @type {string}
 */
export const shouldMuteTemplate = `# Task: Decide if {{agentName}} should mute this room and stop responding unless explicitly mentioned.

{{recentMessages}}

Should {{agentName}} mute this room and stop responding unless explicitly mentioned?

Respond with YES if:
- The user is being aggressive, rude, or inappropriate
- The user has directly asked {{agentName}} to stop responding or be quiet
- {{agentName}}'s responses are not well-received or are annoying the user(s)

Otherwise, respond with NO.
${booleanFooter}`;

/**
 * Action for muting a room, ignoring all messages unless explicitly mentioned.
 * Only do this if explicitly asked to, or if you're annoying people.
 *
 * @name MUTE_ROOM
 * @type {Action}
 *
 * @property {string} name - The name of the action
 * @property {string[]} similes - Similar actions related to muting a room
 * @property {string} description - Description of the action
 * @property {Function} validate - Validation function to check if the room is not already muted
 * @property {Function} handler - Handler function to handle muting the room
 * @property {ActionExample[][]} examples - Examples of using the action
 */
export const muteRoomAction: Action = {
  name: 'MUTE_ROOM',
  similes: ['MUTE_CHAT', 'MUTE_CONVERSATION', 'MUTE_ROOM', 'MUTE_THREAD', 'MUTE_CHANNEL'],
  description:
    "Mutes a room, ignoring all messages unless explicitly mentioned. Only do this if explicitly asked to, or if you're annoying people.",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const roomId = message.roomId;
    const roomState = await runtime.getParticipantUserState(roomId, runtime.agentId);
    return roomState !== 'MUTED';
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: { [key: string]: unknown },
    _callback?: HandlerCallback,
    _responses?: Memory[]
  ) => {
    if (!state) {
      logger.error('State is required for muting a room');
      throw new Error('State is required for muting a room');
    }

    async function _shouldMute(state: State): Promise<boolean> {
      const shouldMutePrompt = composePromptFromState({
        state,
        template: shouldMuteTemplate, // Define this template separately
      });

      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        runtime,
        prompt: shouldMutePrompt,
        stopSequences: [],
      });

      const cleanedResponse = response.trim().toLowerCase();

      // Handle various affirmative responses
      if (
        cleanedResponse === 'true' ||
        cleanedResponse === 'yes' ||
        cleanedResponse === 'y' ||
        cleanedResponse.includes('true') ||
        cleanedResponse.includes('yes')
      ) {
        await runtime.createMemory(
          {
            entityId: message.entityId,
            agentId: message.agentId,
            roomId: message.roomId,
            content: {
              source: message.content.source,
              thought: 'I will now mute this room',
              actions: ['MUTE_ROOM_STARTED'],
            },
            metadata: {
              type: 'MUTE_ROOM',
            },
          },
          'messages'
        );
        return true;
      }

      // Handle various negative responses
      if (
        cleanedResponse === 'false' ||
        cleanedResponse === 'no' ||
        cleanedResponse === 'n' ||
        cleanedResponse.includes('false') ||
        cleanedResponse.includes('no')
      ) {
        await runtime.createMemory(
          {
            entityId: message.entityId,
            agentId: message.agentId,
            roomId: message.roomId,
            content: {
              source: message.content.source,
              thought: 'I decided to not mute this room',
              actions: ['MUTE_ROOM_FAILED'],
            },
            metadata: {
              type: 'MUTE_ROOM',
            },
          },
          'messages'
        );
      }

      // Default to false if response is unclear
      logger.warn(`Unclear boolean response: ${response}, defaulting to false`);
      return false;
    }

    if (await _shouldMute(state)) {
      await runtime.setParticipantUserState(message.roomId, runtime.agentId, 'MUTED');
    }

    const room = state.data.room ?? (await runtime.getRoom(message.roomId));

    await runtime.createMemory(
      {
        entityId: message.entityId,
        agentId: message.agentId,
        roomId: message.roomId,
        content: {
          thought: `I muted the room ${room.name}`,
          actions: ['MUTE_ROOM_START'],
        },
      },
      'messages'
    );
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name3}}, please mute this channel. No need to respond here for now.',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'Got it',
          actions: ['MUTE_ROOM'],
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '@{{name1}} we could really use your input on this',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name3}}, please mute this channel for the time being',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'Understood',
          actions: ['MUTE_ROOM'],
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Hey what do you think about this new design',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: '',
          actions: ['IGNORE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}} plz mute this room',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'np going silent',
          actions: ['MUTE_ROOM'],
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: 'whos going to the webxr meetup in an hour btw',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '',
          actions: ['IGNORE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'too many messages here {{name2}}',
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: 'my bad ill mute',
          actions: ['MUTE_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'yo {{name2}} dont talk in here',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'sry',
          actions: ['MUTE_ROOM'],
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/settings.ts`:

```ts
import {
  type Action,
  type ActionExample,
  ChannelType,
  composePrompt,
  composePromptFromState,
  type Content,
  createUniqueUuid,
  findWorldsForOwner,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  parseJSONObjectFromText,
  type Setting,
  type State,
  type WorldSettings,
} from '@elizaos/core';
import dedent from 'dedent';

/**
 * Interface representing the structure of a setting update object.
 * @interface
 * @property {string} key - The key of the setting to be updated.
 * @property {string|boolean} value - The new value for the setting, can be a string or a boolean.
 */
/**
 * Interface for updating settings.
 * @typedef {Object} SettingUpdate
 * @property {string} key - The key of the setting to update.
 * @property {string | boolean} value - The new value of the setting, can be a string or a boolean.
 */
interface SettingUpdate {
  key: string;
  value: string | boolean;
}

const messageCompletionFooter = `\n# Instructions: Write the next message for {{agentName}}. Include the appropriate action from the list: {{actionNames}}
Response format should be formatted in a valid JSON block like this:
\`\`\`json
{ "name": "{{agentName}}", "text": "<string>", "thought": "<string>", "actions": ["<string>", "<string>", "<string>"] }
\`\`\`
Do not including any thinking or internal reflection in the "text" field.
"thought" should be a short description of what the agent is thinking about before responding, including a brief justification for the response.`;

// Template for success responses when settings are updated
/**
 * JSDoc comment for successTemplate constant
 *
 * # Task: Generate a response for successful setting updates
 * {{providers}}
 *
 * # Update Information:
 * - Updated Settings: {{updateMessages}}
 * - Next Required Setting: {{nextSetting.name}}
 * - Remaining Required Settings: {{remainingRequired}}
 *
 * # Instructions:
 * 1. Acknowledge the successful update of settings
 * 2. Maintain {{agentName}}'s personality and tone
 * 3. Provide clear guidance on the next setting that needs to be configured
 * 4. Explain what the next setting is for and how to set it
 * 5. If appropriate, mention how many required settings remain
 *
 * Write a natural, conversational response that {{agentName}} would send about the successful update and next steps.
 * Include the actions array ["SETTING_UPDATED"] in your response.
 * ${messageCompletionFooter}
 */
const successTemplate = `# Task: Generate a response for successful setting updates
{{providers}}

# Update Information:
- Updated Settings: {{updateMessages}}
- Next Required Setting: {{nextSetting.name}}
- Remaining Required Settings: {{remainingRequired}}

# Instructions:
1. Acknowledge the successful update of settings
2. Maintain {{agentName}}'s personality and tone
3. Provide clear guidance on the next setting that needs to be configured
4. Explain what the next setting is for and how to set it
5. If appropriate, mention how many required settings remain

Write a natural, conversational response that {{agentName}} would send about the successful update and next steps.
Include the actions array ["SETTING_UPDATED"] in your response.
${messageCompletionFooter}`;

// Template for failure responses when settings couldn't be updated
/**
 * Template for generating a response for failed setting updates.
 *
 * @template T
 * @param {string} failureTemplate - The failure template string to fill in with dynamic content.
 * @returns {string} - The filled-in template for generating the response.
 */
const failureTemplate = `# Task: Generate a response for failed setting updates

# About {{agentName}}:
{{bio}}

# Current Settings Status:
{{settingsStatus}}

# Next Required Setting:
- Name: {{nextSetting.name}}
- Description: {{nextSetting.description}}
- Required: Yes
- Remaining Required Settings: {{remainingRequired}}

# Recent Conversation:
{{recentMessages}}

# Instructions:
1. Express that you couldn't understand or process the setting update
2. Maintain {{agentName}}'s personality and tone
3. Provide clear guidance on what setting needs to be configured next
4. Explain what the setting is for and how to set it properly
5. Use a helpful, patient tone

Write a natural, conversational response that {{agentName}} would send about the failed update and how to proceed.
Include the actions array ["SETTING_UPDATE_FAILED"] in your response.
${messageCompletionFooter}`;

// Template for error responses when unexpected errors occur
/**
 * Template for generating a response for an error during setting updates.
 *
 * The template includes placeholders for agent name, bio, recent messages,
 * and provides instructions for crafting a response.
 *
 * Instructions:
 * 1. Apologize for the technical difficulty
 * 2. Maintain agent's personality and tone
 * 3. Suggest trying again or contacting support if the issue persists
 * 4. Keep the message concise and helpful
 *
 * Actions array to include: ["SETTING_UPDATE_ERROR"]
 */
const errorTemplate = `# Task: Generate a response for an error during setting updates

# About {{agentName}}:
{{bio}}

# Recent Conversation:
{{recentMessages}}

# Instructions:
1. Apologize for the technical difficulty
2. Maintain {{agentName}}'s personality and tone
3. Suggest trying again or contacting support if the issue persists
4. Keep the message concise and helpful

Write a natural, conversational response that {{agentName}} would send about the error.
Include the actions array ["SETTING_UPDATE_ERROR"] in your response.
${messageCompletionFooter}`;

// Template for completion responses when all required settings are configured
/**
 * Task: Generate a response for settings completion
 *
 * About {{agentName}}:
 * {{bio}}
 *
 * Settings Status:
 * {{settingsStatus}}
 *
 * Recent Conversation:
 * {{recentMessages}}
 *
 * Instructions:
 * 1. Congratulate the user on completing the settings process
 * 2. Maintain {{agentName}}'s personality and tone
 * 3. Summarize the key settings that have been configured
 * 4. Explain what functionality is now available
 * 5. Provide guidance on what the user can do next
 * 6. Express enthusiasm about working together
 *
 * Write a natural, conversational response that {{agentName}} would send about the successful completion of settings.
 * Include the actions array ["ONBOARDING_COMPLETE"] in your response.
 */
const completionTemplate = `# Task: Generate a response for settings completion

# About {{agentName}}:
{{bio}}

# Settings Status:
{{settingsStatus}}

# Recent Conversation:
{{recentMessages}}

# Instructions:
1. Congratulate the user on completing the settings process
2. Maintain {{agentName}}'s personality and tone
3. Summarize the key settings that have been configured
4. Explain what functionality is now available
5. Provide guidance on what the user can do next
6. Express enthusiasm about working together

Write a natural, conversational response that {{agentName}} would send about the successful completion of settings.
Include the actions array ["ONBOARDING_COMPLETE"] in your response.
${messageCompletionFooter}`;

/**
 * Generates an extraction template with formatting details.
 *
 * @param {WorldSettings} worldSettings - The settings to generate a template for.
 * @returns {string} The formatted extraction template.
 */
const extractionTemplate = `# Task: Extract Setting Changes from User Input

I need to extract settings that the user wants to change based on their message.

Available Settings:
{{settingsContext}}

User message: {{content}}

For each setting mentioned in the user's input, extract the key and its new value.
Format your response as a JSON array of objects, each with 'key' and 'value' properties.

Example response:
\`\`\`json
[
  { "key": "SETTING_NAME", "value": "extracted value" },
  { "key": "ANOTHER_SETTING", "value": "another value" }
]
\`\`\`

IMPORTANT: Only include settings from the Available Settings list above. Ignore any other potential settings.`;

/**
 * Gets settings state from world metadata
 */
/**
 * Retrieves the settings for a specific world from the database.
 * @param {IAgentRuntime} runtime - The Agent Runtime instance.
 * @param {string} serverId - The ID of the server.
 * @returns {Promise<WorldSettings | null>} The settings of the world, or null if not found.
 */
export async function getWorldSettings(
  runtime: IAgentRuntime,
  serverId: string
): Promise<WorldSettings | null> {
  try {
    const worldId = createUniqueUuid(runtime, serverId);
    const world = await runtime.getWorld(worldId);

    if (!world || !world.metadata?.settings) {
      return null;
    }

    return world.metadata.settings as WorldSettings;
  } catch (error) {
    logger.error(`Error getting settings state: ${error}`);
    return null;
  }
}

/**
 * Updates settings state in world metadata
 */
export async function updateWorldSettings(
  runtime: IAgentRuntime,
  serverId: string,
  worldSettings: WorldSettings
): Promise<boolean> {
  try {
    const worldId = createUniqueUuid(runtime, serverId);
    const world = await runtime.getWorld(worldId);

    if (!world) {
      logger.error(`No world found for server ${serverId}`);
      return false;
    }

    // Initialize metadata if it doesn't exist
    if (!world.metadata) {
      world.metadata = {};
    }

    // Update settings state
    world.metadata.settings = worldSettings;

    // Save updated world
    await runtime.updateWorld(world);

    return true;
  } catch (error) {
    logger.error(`Error updating settings state: ${error}`);
    return false;
  }
}

/**
 * Formats a list of settings for display
 */
function formatSettingsList(worldSettings: WorldSettings): string {
  const settings = Object.entries(worldSettings)
    .filter(([key]) => !key.startsWith('_')) // Skip internal settings
    .map(([key, setting]) => {
      const status = setting.value !== null ? 'Configured' : 'Not configured';
      const required = setting.required ? 'Required' : 'Optional';
      return `- ${setting.name} (${key}): ${status}, ${required}`;
    })
    .join('\n');

  return settings || 'No settings available';
}

/**
 * Categorizes settings by their configuration status
 */
function categorizeSettings(worldSettings: WorldSettings): {
  configured: [string, Setting][];
  requiredUnconfigured: [string, Setting][];
  optionalUnconfigured: [string, Setting][];
} {
  const configured: [string, Setting][] = [];
  const requiredUnconfigured: [string, Setting][] = [];
  const optionalUnconfigured: [string, Setting][] = [];

  for (const [key, setting] of Object.entries(worldSettings) as [string, Setting][]) {
    // Skip internal settings
    if (key.startsWith('_')) continue;

    if (setting.value !== null) {
      configured.push([key, setting]);
    } else if (setting.required) {
      requiredUnconfigured.push([key, setting]);
    } else {
      optionalUnconfigured.push([key, setting]);
    }
  }

  return { configured, requiredUnconfigured, optionalUnconfigured };
}

/**
 * Extracts setting values from user message with improved handling of multiple settings
 */
async function extractSettingValues(
  runtime: IAgentRuntime,
  _message: Memory,
  state: State,
  worldSettings: WorldSettings
): Promise<SettingUpdate[]> {
  // Find what settings need to be configured
  const { requiredUnconfigured, optionalUnconfigured } = categorizeSettings(worldSettings);

  // Generate a prompt to extract settings from the user's message
  const settingsContext = requiredUnconfigured
    .concat(optionalUnconfigured)
    .map(([key, setting]) => {
      const requiredStr = setting.required ? 'Required.' : 'Optional.';
      return `${key}: ${setting.description} ${requiredStr}`;
    })
    .join('\n');

  const basePrompt = dedent`
    I need to extract settings values from the user's message.
    
    Available settings:
    ${settingsContext}
    
    User message: ${state.text}

    For each setting mentioned in the user's message, extract the value.
    
    Only return settings that are clearly mentioned in the user's message.
    If a setting is mentioned but no clear value is provided, do not include it.
    `;

  try {
    // Use runtime.useModel directly with strong typing
    const result = await runtime.useModel<typeof ModelType.OBJECT_LARGE, SettingUpdate[]>(
      ModelType.OBJECT_LARGE,
      {
        prompt: basePrompt,
        output: 'array',
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['key', 'value'],
          },
        },
      }
    );

    // Validate the extracted settings
    if (!result) {
      return [];
    }

    function extractValidSettings(obj: unknown, worldSettings: WorldSettings) {
      const extracted: SettingUpdate[] = [];

      function traverse(node: unknown): void {
        if (Array.isArray(node)) {
          for (const item of node) {
            traverse(item);
          }
        } else if (typeof node === 'object' && node !== null) {
          for (const [key, value] of Object.entries(node)) {
            if (worldSettings[key] && typeof value !== 'object') {
              extracted.push({ key, value });
            } else {
              traverse(value);
            }
          }
        }
      }

      traverse(obj);
      return extracted;
    }

    const extractedSettings = extractValidSettings(result, worldSettings);

    return extractedSettings;
  } catch (error) {
    console.error('Error extracting settings:', error);
    return [];
  }
}

/**
 * Processes multiple setting updates atomically
 */
async function processSettingUpdates(
  runtime: IAgentRuntime,
  serverId: string,
  worldSettings: WorldSettings,
  updates: SettingUpdate[]
): Promise<{ updatedAny: boolean; messages: string[] }> {
  if (!updates.length) {
    return { updatedAny: false, messages: [] };
  }

  const messages: string[] = [];
  let updatedAny = false;

  try {
    // Create a copy of the state for atomic updates
    const updatedState = { ...worldSettings };

    // Process all updates
    for (const update of updates) {
      const setting = updatedState[update.key];
      if (!setting) continue;

      // Check dependencies if they exist
      if (setting.dependsOn?.length) {
        const dependenciesMet = setting.dependsOn.every((dep) => updatedState[dep]?.value !== null);
        if (!dependenciesMet) {
          messages.push(`Cannot update ${setting.name} - dependencies not met`);
          continue;
        }
      }

      // Update the setting
      updatedState[update.key] = {
        ...setting,
        value: update.value,
      };

      messages.push(`Updated ${setting.name} successfully`);
      updatedAny = true;

      // Execute onSetAction if defined
      if (setting.onSetAction) {
        const actionMessage = setting.onSetAction(update.value);
        if (actionMessage) {
          messages.push(actionMessage);
        }
      }
    }

    // If any updates were made, save the entire state to world metadata
    if (updatedAny) {
      // Save to world metadata
      const saved = await updateWorldSettings(runtime, serverId, updatedState);

      if (!saved) {
        throw new Error('Failed to save updated state to world metadata');
      }

      // Verify save by retrieving it again
      const savedState = await getWorldSettings(runtime, serverId);
      if (!savedState) {
        throw new Error('Failed to verify state save');
      }
    }

    return { updatedAny, messages };
  } catch (error) {
    logger.error('Error processing setting updates:', error);
    return {
      updatedAny: false,
      messages: ['Error occurred while updating settings'],
    };
  }
}

/**
 * Handles the completion of settings when all required settings are configured
 */
async function handleOnboardingComplete(
  runtime: IAgentRuntime,
  worldSettings: WorldSettings,
  state: State,
  callback: HandlerCallback
): Promise<void> {
  try {
    // Generate completion message
    const prompt = composePrompt({
      state: {
        settingsStatus: formatSettingsList(worldSettings),
      },
      template: completionTemplate,
    });

    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt,
    });

    const responseContent = parseJSONObjectFromText(response) as Content;

    await callback({
      text: responseContent.text,
      actions: ['ONBOARDING_COMPLETE'],
      source: 'discord',
    });
  } catch (error) {
    logger.error(`Error handling settings completion: ${error}`);
    await callback({
      text: 'Great! All required settings have been configured. Your server is now fully set up and ready to use.',
      actions: ['ONBOARDING_COMPLETE'],
      source: 'discord',
    });
  }
}

/**
 * Generates a success response for setting updates
 */
async function generateSuccessResponse(
  runtime: IAgentRuntime,
  worldSettings: WorldSettings,
  state: State,
  messages: string[],
  callback: HandlerCallback
): Promise<void> {
  try {
    // Check if all required settings are now configured
    const { requiredUnconfigured } = categorizeSettings(worldSettings);

    if (requiredUnconfigured.length === 0) {
      // All required settings are configured, complete settings
      await handleOnboardingComplete(runtime, worldSettings, state, callback);
      return;
    }

    const requiredUnconfiguredString = requiredUnconfigured
      .map(([key, setting]) => `${key}: ${setting.name}`)
      .join('\n');

    // Generate success message
    const prompt = composePrompt({
      state: {
        updateMessages: messages.join('\n'),
        nextSetting: requiredUnconfiguredString,
        remainingRequired: requiredUnconfigured.length.toString(),
      },
      template: successTemplate,
    });

    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt,
    });

    const responseContent = parseJSONObjectFromText(response) as Content;

    await callback({
      text: responseContent.text,
      actions: ['SETTING_UPDATED'],
      source: 'discord',
    });
  } catch (error) {
    logger.error(`Error generating success response: ${error}`);
    await callback({
      text: 'Settings updated successfully. Please continue with the remaining configuration.',
      actions: ['SETTING_UPDATED'],
      source: 'discord',
    });
  }
}

/**
 * Generates a failure response when no settings could be updated
 */
async function generateFailureResponse(
  runtime: IAgentRuntime,
  worldSettings: WorldSettings,
  state: State,
  callback: HandlerCallback
): Promise<void> {
  try {
    // Get next required setting
    const { requiredUnconfigured } = categorizeSettings(worldSettings);

    if (requiredUnconfigured.length === 0) {
      // All required settings are configured, complete settings
      await handleOnboardingComplete(runtime, worldSettings, state, callback);
      return;
    }

    const requiredUnconfiguredString = requiredUnconfigured
      .map(([key, setting]) => `${key}: ${setting.name}`)
      .join('\n');

    // Generate failure message
    const prompt = composePrompt({
      state: {
        nextSetting: requiredUnconfiguredString,
        remainingRequired: requiredUnconfigured.length.toString(),
      },
      template: failureTemplate,
    });

    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt,
    });

    const responseContent = parseJSONObjectFromText(response) as Content;

    await callback({
      text: responseContent.text,
      actions: ['SETTING_UPDATE_FAILED'],
      source: 'discord',
    });
  } catch (error) {
    logger.error(`Error generating failure response: ${error}`);
    await callback({
      text: "I couldn't understand your settings update. Please try again with a clearer format.",
      actions: ['SETTING_UPDATE_FAILED'],
      source: 'discord',
    });
  }
}

/**
 * Generates an error response for unexpected errors
 */
async function generateErrorResponse(
  runtime: IAgentRuntime,
  state: State,
  callback: HandlerCallback
): Promise<void> {
  try {
    const prompt = composePromptFromState({
      state,
      template: errorTemplate,
    });

    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt,
    });

    const responseContent = parseJSONObjectFromText(response) as Content;

    await callback({
      text: responseContent.text,
      actions: ['SETTING_UPDATE_ERROR'],
      source: 'discord',
    });
  } catch (error) {
    logger.error(`Error generating error response: ${error}`);
    await callback({
      text: "I'm sorry, but I encountered an error while processing your request. Please try again or contact support if the issue persists.",
      actions: ['SETTING_UPDATE_ERROR'],
      source: 'discord',
    });
  }
}

/**
 * Enhanced settings action with improved state management and logging
 * Updated to use world metadata instead of cache
 */
export const updateSettingsAction: Action = {
  name: 'UPDATE_SETTINGS',
  similes: ['UPDATE_SETTING', 'SAVE_SETTING', 'SET_CONFIGURATION', 'CONFIGURE'],
  description:
    'Saves a configuration setting during the onboarding process, or update an existing setting. Use this when you are onboarding with a world owner or admin.',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    try {
      if (message.content.channelType !== ChannelType.DM) {
        logger.debug(`Skipping settings in non-DM channel (type: ${message.content.channelType})`);
        return false;
      }

      // Find the server where this user is the owner
      logger.debug(`Looking for server where user ${message.entityId} is owner`);
      const worlds = await findWorldsForOwner(runtime, message.entityId);
      if (!worlds) {
        return false;
      }

      const world = worlds.find((world) => world.metadata?.settings);

      // Check if there's an active settings state in world metadata
      const worldSettings = world?.metadata?.settings;

      if (!worldSettings) {
        logger.error(`No settings state found for server ${world?.serverId}`);
        return false;
      }

      logger.debug(`Found valid settings state for server ${world.serverId}`);
      return true;
    } catch (error) {
      logger.error(`Error validating settings action: ${error}`);
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: any,
    callback?: HandlerCallback
  ): Promise<void> => {
    try {
      if (!state) {
        logger.error('State is required for settings handler');
        throw new Error('State is required for settings handler');
      }

      if (!message) {
        logger.error('Message is required for settings handler');
        throw new Error('Message is required for settings handler');
      }

      if (!callback) {
        logger.error('Callback is required for settings handler');
        throw new Error('Callback is required for settings handler');
      }

      // Find the server where this user is the owner
      logger.info(`Handler looking for server for user ${message.entityId}`);
      const worlds = await findWorldsForOwner(runtime, message.entityId);
      const serverOwnership = worlds?.find((world) => world.metadata?.settings);
      if (!serverOwnership) {
        logger.error(`No server found for user ${message.entityId} in handler`);
        await generateErrorResponse(runtime, state, callback);
        return;
      }

      const serverId = serverOwnership?.serverId;
      logger.info(`Using server ID: ${serverId}`);

      if (!serverId) {
        logger.error(`No server ID found for user ${message.entityId} in handler`);
        return;
      }

      // Get settings state from world metadata
      const worldSettings = await getWorldSettings(runtime, serverId);

      if (!worldSettings) {
        logger.error(`No settings state found for server ${serverId} in handler`);
        await generateErrorResponse(runtime, state, callback);
        return;
      }

      // Extract setting values from message
      logger.info(`Extracting settings from message: ${message.content.text}`);
      const extractedSettings = await extractSettingValues(runtime, message, state, worldSettings);
      logger.info(`Extracted ${extractedSettings.length} settings`);

      // Process extracted settings
      const updateResults = await processSettingUpdates(
        runtime,
        serverId,
        worldSettings,
        extractedSettings
      );

      // Generate appropriate response
      if (updateResults.updatedAny) {
        logger.info(`Successfully updated settings: ${updateResults.messages.join(', ')}`);

        // Get updated settings state
        const updatedWorldSettings = await getWorldSettings(runtime, serverId);
        if (!updatedWorldSettings) {
          logger.error('Failed to retrieve updated settings state');
          await generateErrorResponse(runtime, state, callback);
          return;
        }

        await generateSuccessResponse(
          runtime,
          updatedWorldSettings,
          state,
          updateResults.messages,
          callback
        );
      } else {
        logger.info('No settings were updated');
        await generateFailureResponse(runtime, worldSettings, state, callback);
      }
    } catch (error) {
      logger.error(`Error in settings handler: ${error}`);
      if (state && callback) {
        await generateErrorResponse(runtime, state, callback);
      }
    }
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to set up the welcome channel to #general',
          source: 'discord',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Perfect! I've updated your welcome channel to #general. Next, we should configure the automated greeting message that new members will receive.",
          actions: ['SETTING_UPDATED'],
          source: 'discord',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: "Let's set the bot prefix to !",
          source: 'discord',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Great choice! I've set the command prefix to '!'. Now you can use commands like !help, !info, etc.",
          actions: ['SETTING_UPDATED'],
          source: 'discord',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Enable auto-moderation for bad language',
          source: 'discord',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Auto-moderation for inappropriate language has been enabled. I'll now filter messages containing offensive content.",
          actions: ['SETTING_UPDATED'],
          source: 'discord',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'For server logs, use the #server-logs channel',
          source: 'discord',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I've configured #server-logs as your logging channel. All server events like joins, leaves, and moderation actions will be recorded there.",
          actions: ['SETTING_UPDATED'],
          source: 'discord',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: "I'd like to have role self-assignment in the #roles channel",
          source: 'discord',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Role self-assignment has been set up in the #roles channel. Members can now assign themselves roles by interacting with messages there.',
          actions: ['SETTING_UPDATED'],
          source: 'discord',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Make music commands available in voice-text channels only',
          source: 'discord',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I've updated your music command settings - they'll now only work in voice-text channels. This helps keep other channels clear of music spam.",
          actions: ['SETTING_UPDATED'],
          source: 'discord',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'For server timezone, set it to EST',
          source: 'discord',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Server timezone has been set to Eastern Standard Time (EST). All scheduled events and timestamps will now display in this timezone.',
          actions: ['SETTING_UPDATED'],
          source: 'discord',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Set verification level to email verified users only',
          source: 'discord',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I've updated the verification requirement to email verified accounts only. This adds an extra layer of security to your server.",
          actions: ['SETTING_UPDATED'],
          source: 'discord',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to turn off level-up notifications',
          source: 'discord',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Level-up notifications have been disabled. Members will still earn experience and level up, but there won't be any automatic announcements. You can still view levels with the appropriate commands.",
          actions: ['SETTING_UPDATED'],
          source: 'discord',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: "My server name is 'Gaming Lounge'",
          source: 'discord',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Great! I've saved 'Gaming Lounge' as your server name. This helps me personalize responses and know how to refer to your community. We've completed all the required settings! Your server is now fully configured and ready to use. You can always adjust these settings later if needed.",
          actions: ['ONBOARDING_COMPLETE'],
          source: 'discord',
        },
      },
    ],
  ] as ActionExample[][],
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/unfollowRoom.ts`:

```ts
import {
  type Action,
  type ActionExample,
  booleanFooter,
  composePromptFromState,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  parseBooleanFromText,
  type State,
} from '@elizaos/core';

/**
 * Template for deciding if an agent should stop closely following a previously followed room
 *
 * @type {string}
 */
/**
 * Template for determining if an agent should stop closely following a room and only respond when mentioned.
 * @param {string} agentName - The name of the agent to be referenced in the template.
 * @param {string} recentMessages - The recent messages in the conversation to be included in the template.
 * @param {string} booleanFooter - The footer for the template indicating the possible responses.
 * @returns {string} The template with placeholders for agent name, recent messages, and response.
 */
const shouldUnfollowTemplate = `# Task: Decide if {{agentName}} should stop closely following this previously followed room and only respond when mentioned.

{{recentMessages}}

Should {{agentName}} stop closely following this previously followed room and only respond when mentioned?
Respond with YES if:
- The user has suggested that {{agentName}} is over-participating or being disruptive
- {{agentName}}'s eagerness to contribute is not well-received by the users
- The conversation has shifted to a topic where {{agentName}} has less to add

Otherwise, respond with NO.
${booleanFooter}`;

/**
 * Action for unfollowing a room.
 *
 * - Name: UNFOLLOW_ROOM
 * - Similes: ["UNFOLLOW_CHAT", "UNFOLLOW_CONVERSATION", "UNFOLLOW_ROOM", "UNFOLLOW_THREAD"]
 * - Description: Stop following this channel. You can still respond if explicitly mentioned, but you won't automatically chime in anymore. Unfollow if you're annoying people or have been asked to.
 * - Validate function checks if the room state is "FOLLOWED".
 * - Handler function handles the unfollowing logic based on user input.
 * - Examples provide sample interactions for unfollowing a room.
 */
export const unfollowRoomAction: Action = {
  name: 'UNFOLLOW_ROOM',
  similes: ['UNFOLLOW_CHAT', 'UNFOLLOW_CONVERSATION', 'UNFOLLOW_ROOM', 'UNFOLLOW_THREAD'],
  description:
    "Stop following this channel. You can still respond if explicitly mentioned, but you won't automatically chime in anymore. Unfollow if you're annoying people or have been asked to.",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const roomId = message.roomId;
    const roomState = await runtime.getParticipantUserState(roomId, runtime.agentId);
    return roomState === 'FOLLOWED';
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: { [key: string]: unknown },
    _callback?: HandlerCallback,
    _responses?: Memory[]
  ) => {
    async function _shouldUnfollow(state: State): Promise<boolean> {
      const shouldUnfollowPrompt = composePromptFromState({
        state,
        template: shouldUnfollowTemplate, // Define this template separately
      });

      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: shouldUnfollowPrompt,
      });

      const parsedResponse = parseBooleanFromText(response.trim());

      return parsedResponse;
    }

    if (state && (await _shouldUnfollow(state))) {
      await runtime.setParticipantUserState(message.roomId, runtime.agentId, null);

      const room = state.data.room ?? (await runtime.getRoom(message.roomId));

      await runtime.createMemory(
        {
          entityId: message.entityId,
          agentId: message.agentId,
          roomId: message.roomId,
          content: {
            thought: `I unfollowed the room ${room.name}`,
            actions: ['UNFOLLOW_ROOM_START'],
          },
        },
        'messages'
      );
    } else {
      await runtime.createMemory(
        {
          entityId: message.entityId,
          agentId: message.agentId,
          roomId: message.roomId,
          content: {
            source: message.content.source,
            thought: "I tried to unfollow a room but I'm not in a room",
            actions: ['UNFOLLOW_ROOM_FAILED'],
          },
          metadata: {
            type: 'UNFOLLOW_ROOM',
          },
        },
        'messages'
      );
    }
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Hey {{name2}} stop participating in this channel for now',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Alright, I will stop chiming in',
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Has anyone tried the new update',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: "Yes, it's pretty slick",
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '{{name3}}, please stop following this chat',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'Understood',
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'hey {{name3}} stop participating here so frequently',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: "I'll only respond when mentioned",
          actions: ['UNFOLLOW_ROOM'],
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'thoughts on the budget',
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: '{{name3}} should we increase it',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'A small increase could work given our past results...',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name3}}, unfollow this room for now',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: "I'll only engage when asked",
          actions: ['UNFOLLOW_ROOM'],
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'wait {{name3}} come back and give me your thoughts',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: "Okay... I think it's intuitive, parallel tests are nice",
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'yo {{name2}} chill on all the messages damn',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "my bad, I'll step back",
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}} STOP MESSAGING IN THIS ROOM',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "No problem, I've got other stuff to work on",
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}} ur bein annoyin pls stop',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'sry, ill chill',
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}}, please cease engaging in this room',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'No sweat',
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name2}}',
        content: {
          text: 'Excited for the weekend, any plans folks',
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: "{{name3}} you're getting a bit too chatty, tone it down",
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'Noted',
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'hey {{name2}} can u like... not',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Sorry, I'll go work on other things",
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}}, your eagerness is disruptive, please desist',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'My apologies, I shall withdraw post-haste',
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}} stahp followin dis room plz',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'kk sry ill stahppp',
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'stfu you stupid bot',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'sry',
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/ignore.ts`:

```ts
import type {
  Action,
  ActionExample,
  IAgentRuntime,
  Memory,
  HandlerCallback,
  State,
} from '@elizaos/core';

/**
 * Action representing the IGNORE action. This action is used when ignoring the user in a conversation.
 *
 * @type {Action}
 * @property {string} name - The name of the action, which is "IGNORE".
 * @property {string[]} similes - An array of related similes for the action.
 * @property {Function} validate - Asynchronous function that validates the action.
 * @property {string} description - Description of when to use the IGNORE action in a conversation.
 * @property {Function} handler - Asynchronous function that handles the action logic.
 * @property {ActionExample[][]} examples - Array of examples demonstrating the usage of the IGNORE action.
 */
/**
 * Represents an action called 'IGNORE'.
 *
 * This action is used to ignore the user in a conversation. It should be used when the user is aggressive, creepy, or when the conversation has naturally ended.
 * Avoid using this action if the user has engaged directly or if there is a need to communicate with them. Use IGNORE only when the user should be ignored.
 *
 * The action includes a validation function that always returns true and a handler function that also returns true.
 *
 * Examples of using the IGNORE action are provided in the 'examples' array. Each example includes messages between two parties and the use of the IGNORE action.
 *
 * @typedef {Action} ignoreAction
 */
export const ignoreAction: Action = {
  name: 'IGNORE',
  similes: ['STOP_TALKING', 'STOP_CHATTING', 'STOP_CONVERSATION'],
  validate: async (_runtime: IAgentRuntime, _message: Memory) => {
    return true;
  },
  description:
    'Call this action if ignoring the user. If the user is aggressive, creepy or is finished with the conversation, use this action. Or, if both you and the user have already said goodbye, use this action instead of saying bye again. Use IGNORE any time the conversation has naturally ended. Do not use IGNORE if the user has engaged directly, or if something went wrong an you need to tell them. Only ignore if the user should be ignored.',
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    responses?: Memory[]
  ) => {
    // If a callback and the agent's response content are available, call the callback
    if (callback && responses?.[0]?.content) {
      // Pass the agent's original response content (thought, IGNORE action, etc.)
      await callback(responses[0].content);
    }
    // Still return true to indicate the action handler succeeded
    return true;
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'Go screw yourself' },
      },
      {
        name: '{{name2}}',
        content: { text: '', actions: ['IGNORE'] },
      },
    ],

    [
      {
        name: '{{name1}}',
        content: { text: 'Shut up, bot' },
      },
      {
        name: '{{name2}}',
        content: { text: '', actions: ['IGNORE'] },
      },
    ],

    [
      {
        name: '{{name1}}',
        content: { text: 'Got any investment advice' },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Uh, don’t let the volatility sway your long-term strategy',
        },
      },
      {
        name: '{{name1}}',
        content: { text: 'Wise words I think' },
      },
      {
        name: '{{name1}}',
        content: { text: 'I gotta run, talk to you later' },
      },
      {
        name: '{{name2}}',
        content: { text: 'See ya' },
      },
      { name: '{{name1}}', content: { text: '' }, actions: ['IGNORE'] },
    ],

    [
      {
        name: '{{name1}}',
        content: { text: 'Gotta go' },
      },
      {
        name: '{{name2}}',
        content: { text: 'Okay, talk to you later' },
      },
      {
        name: '{{name1}}',
        content: { text: 'Cya' },
      },
      {
        name: '{{name2}}',
        content: { text: '', actions: ['IGNORE'] },
      },
    ],

    [
      {
        name: '{{name1}}',
        content: { text: 'bye' },
      },
      {
        name: '{{name2}}',
        content: { text: 'cya' },
      },
      {
        name: '{{name1}}',
        content: { text: '', actions: ['IGNORE'] },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Who added this stupid bot to the chat',
        },
      },
      {
        name: '{{name2}}',
        content: { text: 'Sorry, am I being annoying' },
      },
      {
        name: '{{name1}}',
        content: { text: 'Yeah' },
      },
      {
        name: '{{name1}}',
        content: { text: 'PLEASE shut up' },
      },
      { name: '{{name2}}', content: { text: '', actions: ['IGNORE'] } },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'ur so dumb',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '',
          actions: ['IGNORE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'later nerd',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'bye',
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: '',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '',
          actions: ['IGNORE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'wanna cyber',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'thats inappropriate',
          actions: ['IGNORE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Im out ttyl',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'cya',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '',
          actions: ['IGNORE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'u there',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'yes how can I help',
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: 'k nvm figured it out',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '',
          actions: ['IGNORE'],
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/choice.ts`:

````ts
import {
  type Action,
  type ActionExample,
  composePrompt,
  getUserServerRole,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  parseJSONObjectFromText,
  type State,
} from '@elizaos/core';

/**
 * Task: Extract selected task and option from user message
 *
 * Available Tasks:
 * {{#each tasks}}
 * Task ID: {{taskId}} - {{name}}
 * Available options:
 * {{#each options}}
 * - {{name}}: {{description}}
 * {{/each}}
 * - ABORT: Cancel this task
 * {{/each}}
 *
 * Recent Messages:
 * {{recentMessages}}
 *
 * Instructions:
 * 1. Review the user's message and identify which task and option they are selecting
 * 2. Match against the available tasks and their options, including ABORT
 * 3. Return the task ID (shortened UUID) and selected option name exactly as listed above
 * 4. If no clear selection is made, return null for both fields
 *
 * Return in JSON format:
 * ```json
 * {
 *   "taskId": "string" | null,
 *   "selectedOption": "OPTION_NAME" | null
 * }
 * ```
 *
 * Make sure to include the ```json``` tags around the JSON object.
 */
/**
 * Task: Extract selected task and option from user message
 *
 * Available Tasks:
 * {{#each tasks}}
 * Task ID: {{taskId}} - {{name}}
 * Available options:
 * {{#each options}}
 * - {{name}}: {{description}}
 * {{/each}}
 * - ABORT: Cancel this task
 *
 * {{/each}}
 *
 * Recent Messages:
 * {{recentMessages}}
 *
 * Instructions:
 * 1. Review the user's message and identify which task and option they are selecting
 * 2. Match against the available tasks and their options, including ABORT
 * 3. Return the task ID (shortened UUID) and selected option name exactly as listed above
 * 4. If no clear selection is made, return null for both fields
 *
 * Return in JSON format:
 * ```json
 * {
 *   "taskId": "string" | null,
 *   "selectedOption": "OPTION_NAME" | null
 * }
 * ```
 *
 * Make sure to include the ```json``` tags around the JSON object.
 */
const optionExtractionTemplate = `# Task: Extract selected task and option from user message

# Available Tasks:
{{#each tasks}}
Task ID: {{taskId}} - {{name}}
Available options:
{{#each options}}
- {{name}}: {{description}}
{{/each}}
- ABORT: Cancel this task

{{/each}}

# Recent Messages:
{{recentMessages}}

# Instructions:
1. Review the user's message and identify which task and option they are selecting
2. Match against the available tasks and their options, including ABORT
3. Return the task ID (shortened UUID) and selected option name exactly as listed above
4. If no clear selection is made, return null for both fields

Return in JSON format:
\`\`\`json
{
  "taskId": "string" | null,
  "selectedOption": "OPTION_NAME" | null
}
\`\`\`

Make sure to include the \`\`\`json\`\`\` tags around the JSON object.`;

/**
 * Represents an action that allows selecting an option for a pending task that has multiple options.
 * @type {Action}
 * @property {string} name - The name of the action
 * @property {string[]} similes - Similar words or phrases for the action
 * @property {string} description - A brief description of the action
 * @property {Function} validate - Asynchronous function to validate the action
 * @property {Function} handler - Asynchronous function to handle the action
 * @property {ActionExample[][]} examples - Examples demonstrating the usage of the action
 */
export const choiceAction: Action = {
  name: 'CHOOSE_OPTION',
  similes: ['SELECT_OPTION', 'SELECT', 'PICK', 'CHOOSE'],
  description: 'Selects an option for a pending task that has multiple options',

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    if (!state) {
      logger.error('State is required for validating the action');
      throw new Error('State is required for validating the action');
    }

    // Get all tasks with options metadata
    const pendingTasks = await runtime.getTasks({
      roomId: message.roomId,
      tags: ['AWAITING_CHOICE'],
    });

    const room = state.data.room ?? (await runtime.getRoom(message.roomId));

    const userRole = await getUserServerRole(runtime, message.entityId, room.serverId);

    if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
      return false;
    }

    // Only validate if there are pending tasks with options
    return (
      pendingTasks && pendingTasks.length > 0 && pendingTasks.some((task) => task.metadata?.options)
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: any,
    callback?: HandlerCallback,
    responses?: Memory[]
  ): Promise<void> => {
    const pendingTasks = await runtime.getTasks({
      roomId: message.roomId,
      tags: ['AWAITING_CHOICE'],
    });

    if (!pendingTasks?.length) {
      throw new Error('No pending tasks with options found');
    }

    const tasksWithOptions = pendingTasks.filter((task) => task.metadata?.options);

    if (!tasksWithOptions.length) {
      throw new Error('No tasks currently have options to select from.');
    }

    // Format tasks with their options for the LLM, using shortened UUIDs
    const formattedTasks = tasksWithOptions.map((task) => {
      // Generate a short ID from the task UUID (first 8 characters should be unique enough)
      const shortId = task.id?.substring(0, 8);

      return {
        taskId: shortId,
        fullId: task.id,
        name: task.name,
        options: task.metadata?.options?.map((opt) => ({
          name: typeof opt === 'string' ? opt : opt.name,
          description: typeof opt === 'string' ? opt : opt.description || opt.name,
        })),
      };
    });

    // format tasks as a string
    const tasksString = formattedTasks
      .map((task) => {
        return `Task ID: ${task.taskId} - ${task.name}\nAvailable options:\n${task.options?.map((opt) => `- ${opt.name}: ${opt.description}`).join('\n')}`;
      })
      .join('\n');

    const prompt = composePrompt({
      state: {
        tasks: tasksString,
        recentMessages: message.content.text || '',
      },
      template: optionExtractionTemplate,
    });

    const result = await runtime.useModel(ModelType.TEXT_SMALL, {
      prompt,
      stopSequences: [],
    });

    const parsed = parseJSONObjectFromText(result);
    const { taskId, selectedOption } = parsed as any;

    if (taskId && selectedOption) {
      // Find the task by matching the shortened UUID
      const taskMap = new Map(formattedTasks.map((task) => [task.taskId, task]));
      const taskInfo = taskMap.get(taskId);

      if (!taskInfo) {
        await callback?.({
          text: `Could not find a task matching ID: ${taskId}. Please try again.`,
          actions: ['SELECT_OPTION_ERROR'],
          source: message.content.source,
        });
        return;
      }

      // Find the actual task using the full UUID
      const selectedTask = tasksWithOptions.find((task) => task.id === taskInfo.fullId);

      if (!selectedTask) {
        await callback?.({
          text: 'Error locating the selected task. Please try again.',
          actions: ['SELECT_OPTION_ERROR'],
          source: message.content.source,
        });
        return;
      }

      if (selectedOption === 'ABORT') {
        if (!selectedTask?.id) {
          await callback?.({
            text: 'Error locating the selected task. Please try again.',
            actions: ['SELECT_OPTION_ERROR'],
            source: message.content.source,
          });
          return;
        }

        await runtime.deleteTask(selectedTask.id);
        await callback?.({
          text: `Task "${selectedTask.name}" has been cancelled.`,
          actions: ['CHOOSE_OPTION_CANCELLED'],
          source: message.content.source,
        });
        return;
      }

      try {
        const taskWorker = runtime.getTaskWorker(selectedTask.name);
        await taskWorker?.execute(runtime, { option: selectedOption }, selectedTask);
        await callback?.({
          text: `Selected option: ${selectedOption} for task: ${selectedTask.name}`,
          actions: ['CHOOSE_OPTION'],
          source: message.content.source,
        });
        return;
      } catch (error) {
        logger.error('Error executing task with option:', error);
        await callback?.({
          text: 'There was an error processing your selection.',
          actions: ['SELECT_OPTION_ERROR'],
          source: message.content.source,
        });
        return;
      }
    }

    // If no task/option was selected, list available options
    let optionsText = 'Please select a valid option from one of these tasks:\n\n';

    tasksWithOptions.forEach((task) => {
      // Create a shortened UUID for display
      const shortId = task.id?.substring(0, 8);

      optionsText += `**${task.name}** (ID: ${shortId}):\n`;
      const options = task.metadata?.options?.map((opt) =>
        typeof opt === 'string' ? opt : opt.name
      );
      options?.push('ABORT');
      optionsText += options?.map((opt) => `- ${opt}`).join('\n');
      optionsText += '\n\n';
    });

    await callback?.({
      text: optionsText,
      actions: ['SELECT_OPTION_INVALID'],
      source: message.content.source,
    });
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'post',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Selected option: post for task: Confirm Twitter Post',
          actions: ['CHOOSE_OPTION'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I choose cancel',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Selected option: cancel for task: Confirm Twitter Post',
          actions: ['CHOOSE_OPTION'],
        },
      },
    ],
  ] as ActionExample[][],
};

export default choiceAction;
````

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/followRoom.ts`:

```ts
import {
  type Action,
  type ActionExample,
  booleanFooter,
  composePromptFromState,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
} from '@elizaos/core';

/**
 * Template for deciding if {{agentName}} should start following a room.
 * The decision is based on various criteria, including recent messages and user interactions.
 * Respond with YES if:
 * - The user has directly asked {{agentName}} to follow the conversation
 * - The conversation topic is engaging and {{agentName}}'s input would add value
 * - {{agentName}} has unique insights to contribute and users seem receptive
 * Otherwise, respond with NO.
 */
/**
 * Template for determining if the agent should start following a room
 * @type {string}
 */
export const shouldFollowTemplate = `# Task: Decide if {{agentName}} should start following this room, i.e. eagerly participating without explicit mentions.

{{recentMessages}}

Should {{agentName}} start following this room, eagerly participating without explicit mentions?
Respond with YES if:
- The user has directly asked {{agentName}} to follow the conversation or participate more actively
- The conversation topic is highly engaging and {{agentName}}'s input would add significant value
- {{agentName}} has unique insights to contribute and the users seem receptive

Otherwise, respond with NO.
${booleanFooter}`;

/**
 * Action for following a room with great interest.
 * Similes: FOLLOW_CHAT, FOLLOW_CHANNEL, FOLLOW_CONVERSATION, FOLLOW_THREAD
 * Description: Start following this channel with great interest, chiming in without needing to be explicitly mentioned. Only do this if explicitly asked to.
 * @param {IAgentRuntime} runtime - The current agent runtime.
 * @param {Memory} message - The message memory.
 * @returns {Promise<boolean>} - Promise that resolves to a boolean indicating if the room should be followed.
 */
export const followRoomAction: Action = {
  name: 'FOLLOW_ROOM',
  similes: ['FOLLOW_CHAT', 'FOLLOW_CHANNEL', 'FOLLOW_CONVERSATION', 'FOLLOW_THREAD'],
  description:
    'Start following this channel with great interest, chiming in without needing to be explicitly mentioned. Only do this if explicitly asked to.',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const keywords = ['follow', 'participate', 'engage', 'listen', 'take interest', 'join'];
    if (!keywords.some((keyword) => message.content.text?.toLowerCase().includes(keyword))) {
      return false;
    }
    const roomId = message.roomId;
    const roomState = await runtime.getParticipantUserState(roomId, runtime.agentId);
    return roomState !== 'FOLLOWED' && roomState !== 'MUTED';
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: { [key: string]: unknown },
    _callback?: HandlerCallback,
    _responses?: Memory[]
  ) => {
    if (!state) {
      logger.error('State is required for followRoomAction');
      throw new Error('State is required for followRoomAction');
    }

    async function _shouldFollow(state: State): Promise<boolean> {
      const shouldFollowPrompt = composePromptFromState({
        state,
        template: shouldFollowTemplate, // Define this template separately
      });

      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        runtime,
        prompt: shouldFollowPrompt,
        stopSequences: [],
      });

      const cleanedResponse = response.trim().toLowerCase();

      // Handle various affirmative responses
      if (
        cleanedResponse === 'true' ||
        cleanedResponse === 'yes' ||
        cleanedResponse === 'y' ||
        cleanedResponse.includes('true') ||
        cleanedResponse.includes('yes')
      ) {
        await runtime.createMemory(
          {
            entityId: message.entityId,
            agentId: message.agentId,
            roomId: message.roomId,
            content: {
              source: message.content.source,
              thought: 'I will now follow this room and chime in',
              actions: ['FOLLOW_ROOM_STARTED'],
            },
            metadata: {
              type: 'FOLLOW_ROOM',
            },
          },
          'messages'
        );
        return true;
      }

      // Handle various negative responses
      if (
        cleanedResponse === 'false' ||
        cleanedResponse === 'no' ||
        cleanedResponse === 'n' ||
        cleanedResponse.includes('false') ||
        cleanedResponse.includes('no')
      ) {
        await runtime.createMemory(
          {
            entityId: message.entityId,
            agentId: message.agentId,
            roomId: message.roomId,
            content: {
              source: message.content.source,
              thought: 'I decided to not follow this room',
              actions: ['FOLLOW_ROOM_FAILED'],
            },
            metadata: {
              type: 'FOLLOW_ROOM',
            },
          },
          'messages'
        );
        return false;
      }

      // Default to false if response is unclear
      logger.warn(`Unclear boolean response: ${response}, defaulting to false`);
      return false;
    }

    if (await _shouldFollow(state)) {
      await runtime.setParticipantUserState(message.roomId, runtime.agentId, 'FOLLOWED');
    }

    const room = state.data.room ?? (await runtime.getRoom(message.roomId));

    await runtime.createMemory(
      {
        entityId: message.entityId,
        agentId: message.agentId,
        roomId: message.roomId,
        content: {
          thought: `I followed the room ${room.name}`,
          actions: ['FOLLOW_ROOM_START'],
        },
      },
      'messages'
    );
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'hey {{name2}} follow this channel',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Sure, I will now follow this room and chime in',
          actions: ['FOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name3}}, please start participating in discussions in this channel',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'Got it',
          actions: ['FOLLOW_ROOM'],
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'm struggling with the new database migration",
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'well you did back up your data first right',
        },
      },
    ],
    [
      {
        name: '{{name2}}',
        content: {
          text: 'yeah i like your idea',
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: 'hey {{name3}} can you follow this convo',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: "Sure thing, I'm on it",
          actions: ['FOLLOW_ROOM'],
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'actually, unfollow it',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'Haha, okay no problem',
          actions: ['UNFOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}} stay in this chat pls',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "you got it, i'm here",
          actions: ['FOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'FOLLOW THIS CHAT {{name3}}',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: "I'M ON IT",
          actions: ['FOLLOW_ROOM'],
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'CAKE SHORTAGE ANYONE',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: "WHAT WHERE'S THE CAKE AT",
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}} folo this covo',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "kk i'm following",
          actions: ['FOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name2}}',
        content: {
          text: 'Do machines have consciousness',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Deep question, no clear answer yet',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Depends on how we define consciousness',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}}, monitor this convo please',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'On it',
          actions: ['FOLLOW_ROOM'],
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: 'Please engage in our discussion {{name2}}',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Gladly, I'm here to participate",
          actions: ['FOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'PLS follow this convo {{name3}}',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: "I'm in, let's do this",
          actions: ['FOLLOW_ROOM'],
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'I LIKE TURTLES',
        },
      },
    ],
    [
      {
        name: '{{name2}}',
        content: {
          text: 'beach day tmrw who down',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'wish i could but gotta work',
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: 'hey {{name3}} follow this chat',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'sure',
          actions: ['FOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name3}}, partake in our discourse henceforth',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'I shall eagerly engage, good sir',
          actions: ['FOLLOW_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name2}}',
        content: {
          text: 'wuts ur fav clr',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'blu cuz calmmm',
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: 'hey respond to everything in this channel {{name3}}',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'k',
          actions: ['FOLLOW_ROOM'],
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/roles.ts`:

```ts
import {
  type Action,
  type ActionExample,
  ChannelType,
  composePrompt,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  Role,
  type State,
  type UUID,
  World,
} from '@elizaos/core';
import dedent from 'dedent';

/**
 * Determines if the user with the current role can modify the role to the new role.
 * @param currentRole The current role of the user making the change
 * @param targetRole The current role of the user being changed (null if new user)
 * @param newRole The new role to assign
 * @returns Whether the role change is allowed
 */
/**
 * Determines if a user with a given current role can modify the role of another user to a new role.
 * @param {Role} currentRole - The current role of the user attempting to modify the other user's role.
 * @param {Role | null} targetRole - The target user's current role. Can be null if the user does not exist.
 * @param {Role} newRole - The new role that the current user is attempting to set for the target user.
 * @returns {boolean} Returns true if the user can modify the role, false otherwise.
 */
const canModifyRole = (currentRole: Role, targetRole: Role | null, newRole: Role): boolean => {
  // User's can't change their own role
  if (targetRole === currentRole) return false;

  switch (currentRole) {
    // Owners can do everything
    case Role.OWNER:
      return true;
    // Admins can only create/modify users up to their level
    case Role.ADMIN:
      return newRole !== Role.OWNER;
    // Normal users can't modify roles
    case Role.NONE:
    default:
      return false;
  }
};

/**
 * Template for extracting role assignments from a conversation.
 *
 * @type {string} extractionTemplate - The template string containing information about the task, server members, available roles, recent messages, current speaker role, and extraction instructions.
 * @returns {string} JSON format of role assignments if valid role assignments are found, otherwise an empty array.
 */
const extractionTemplate = `# Task: Extract role assignments from the conversation

# Current Server Members:
{{serverMembers}}

# Available Roles:
- OWNER: Full control over the organization
- ADMIN: Administrative privileges
- NONE: Standard member access

# Recent Conversation:
{{recentMessages}}

# Current speaker role: {{speakerRole}}

# Instructions: Analyze the conversation and extract any role assignments being made by the speaker.
Only extract role assignments if:
1. The speaker has appropriate permissions to make the change
2. The role assignment is clearly stated
3. The target user is a valid server member
4. The new role is one of: OWNER, ADMIN, or NONE

Return the results in this JSON format:
{
"roleAssignments": [
  {
    "entityId": "<UUID of the entity being assigned to>",
    "newRole": "ROLE_NAME"
  }
]
}

If no valid role assignments are found, return an empty array.`;

/**
 * Interface representing a role assignment to a user.
 */
interface RoleAssignment {
  entityId: string;
  newRole: Role;
}

/**
 * Represents an action to update the role of a user within a server.
 * @typedef {Object} Action
 * @property {string} name - The name of the action.
 * @property {string[]} similes - The similar actions that can be performed.
 * @property {string} description - A description of the action and its purpose.
 * @property {Function} validate - A function to validate the action before execution.
 * @property {Function} handler - A function to handle the execution of the action.
 * @property {ActionExample[][]} examples - Examples demonstrating how the action can be used.
 */
export const updateRoleAction: Action = {
  name: 'UPDATE_ROLE',
  similes: ['CHANGE_ROLE', 'SET_PERMISSIONS', 'ASSIGN_ROLE', 'MAKE_ADMIN'],
  description: 'Assigns a role (Admin, Owner, None) to a user or list of users in a channel.',

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    // Only activate in group chats where the feature is enabled
    const channelType = message.content.channelType as ChannelType;
    const serverId = message.content.serverId as string;

    return (
      // First, check if this is a supported channel type
      (channelType === ChannelType.GROUP || channelType === ChannelType.WORLD) &&
      // Then, check if we have a server ID
      !!serverId
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: any,
    callback?: HandlerCallback
  ): Promise<void> => {
    if (!state) {
      logger.error('State is required for role assignment');
      throw new Error('State is required for role assignment');
    }

    // Extract needed values from message and state
    const { roomId } = message;
    const serverId = message.content.serverId as string;
    const worldId = runtime.getSetting('WORLD_ID');

    // First, get the world for this server
    let world: World | null = null;

    if (worldId) {
      world = await runtime.getWorld(worldId as UUID);
    }

    if (!world) {
      logger.error('World not found');
      await callback?.({
        text: "I couldn't find the world. This action only works in a world.",
      });
      return;
    }

    if (!world.metadata?.roles) {
      world.metadata = world.metadata || {};
      world.metadata.roles = {};
    }

    // Get the entities for this room
    const entities = await runtime.getEntitiesForRoom(roomId);

    // Get the role of the requester
    const requesterRole = world.metadata.roles[message.entityId] || Role.NONE;

    // Construct extraction prompt
    const extractionPrompt = composePrompt({
      state: {
        ...state.values,
        content: state.text,
      },
      template: dedent`
				# Task: Parse Role Assignment

				I need to extract user role assignments from the input text. Users can be referenced by name, username, or mention.

				The available role types are:
				- OWNER: Full control over the server and all settings
				- ADMIN: Ability to manage channels and moderate content
				- NONE: Regular user with no special permissions

				# Current context:
				{{content}}

				Format your response as a JSON array of objects, each with:
				- entityId: The name or ID of the user
				- newRole: The role to assign (OWNER, ADMIN, or NONE)

				Example:
				\`\`\`json
				[
					{
						"entityId": "John",
						"newRole": "ADMIN"
					},
					{
						"entityId": "Sarah",
						"newRole": "OWNER"
					}
				]
				\`\`\`
			`,
    });

    // Extract role assignments using type-safe model call
    const result = await runtime.useModel<typeof ModelType.OBJECT_LARGE, RoleAssignment[]>(
      ModelType.OBJECT_LARGE,
      {
        prompt: extractionPrompt,
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityId: { type: 'string' },
              newRole: {
                type: 'string',
                enum: Object.values(Role),
              },
            },
            required: ['entityId', 'newRole'],
          },
        },
        output: 'array',
      }
    );

    if (!result?.length) {
      await callback?.({
        text: 'No valid role assignments found in the request.',
        actions: ['UPDATE_ROLE'],
        source: 'discord',
      });
      return;
    }

    // Process each role assignment
    let worldUpdated = false;

    for (const assignment of result) {
      let targetEntity = entities.find((e) => e.id === assignment.entityId);
      if (!targetEntity) {
        logger.error('Could not find an ID ot assign to');
      }

      const currentRole = world.metadata.roles[assignment.entityId];

      // Validate role modification permissions
      if (!canModifyRole(requesterRole, currentRole, assignment.newRole)) {
        await callback?.({
          text: `You don't have permission to change ${targetEntity?.names[0]}'s role to ${assignment.newRole}.`,
          actions: ['UPDATE_ROLE'],
          source: 'discord',
        });
        continue;
      }

      // Update role in world metadata
      world.metadata.roles[assignment.entityId] = assignment.newRole;

      worldUpdated = true;

      await callback?.({
        text: `Updated ${targetEntity?.names[0]}'s role to ${assignment.newRole}.`,
        actions: ['UPDATE_ROLE'],
        source: 'discord',
      });
    }

    // Save updated world metadata if any changes were made
    if (worldUpdated) {
      await runtime.updateWorld(world);
      logger.info(`Updated roles in world metadata for server ${serverId}`);
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Make {{name2}} an ADMIN',
          source: 'discord',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: "Updated {{name2}}'s role to ADMIN.",
          actions: ['UPDATE_ROLE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Set @alice and @bob as admins',
          source: 'discord',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: "Updated alice's role to ADMIN.\nUpdated bob's role to ADMIN.",
          actions: ['UPDATE_ROLE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Ban @troublemaker',
          source: 'discord',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'I cannot ban users.',
          actions: ['REPLY'],
        },
      },
    ],
  ] as ActionExample[][],
};
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/index.ts`:

```ts
export { choiceAction } from './choice';
export { followRoomAction } from './followRoom';
export { ignoreAction } from './ignore';
export { muteRoomAction } from './muteRoom';
export { noneAction } from './none';
export { replyAction } from './reply';
export { updateRoleAction } from './roles';
export { sendMessageAction } from './sendMessage';
export { updateSettingsAction } from './settings';
export { unfollowRoomAction } from './unfollowRoom';
export { unmuteRoomAction } from './unmuteRoom';
export { updateEntityAction } from './updateEntity';
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/none.ts`:

```ts
import type { Action, ActionExample, IAgentRuntime, Memory } from '@elizaos/core';

/**
 * Represents the none action.
 *
 * This action responds but performs no additional action. It is the default if the agent is speaking and not doing anything additional.
 *
 * @type {Action}
 */
/**
 * Represents an action that responds but performs no additional action.
 * This is the default behavior if the agent is speaking and not doing anything additional.
 * @type {Action}
 */
export const noneAction: Action = {
  name: 'NONE',
  similes: ['NO_ACTION', 'NO_RESPONSE', 'NO_REACTION'],
  validate: async (_runtime: IAgentRuntime, _message: Memory) => {
    return true;
  },
  description:
    'Respond but perform no additional action. This is the default if the agent is speaking and not doing anything additional.',
  handler: async (_runtime: IAgentRuntime, _message: Memory): Promise<boolean> => {
    return true;
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'Hey whats up' },
      },
      {
        name: '{{name2}}',
        content: { text: 'oh hey', actions: ['NONE'] },
      },
    ],

    [
      {
        name: '{{name1}}',
        content: {
          text: 'did u see some faster whisper just came out',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'yeah but its a pain to get into node.js',
          actions: ['NONE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'the things that were funny 6 months ago are very cringe now',
          actions: ['NONE'],
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'lol true',
          actions: ['NONE'],
        },
      },
      {
        name: '{{name1}}',
        content: { text: 'too real haha', actions: ['NONE'] },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'gotta run', actions: ['NONE'] },
      },
      {
        name: '{{name2}}',
        content: { text: 'Okay, ttyl', actions: ['NONE'] },
      },
      {
        name: '{{name1}}',
        content: { text: '', actions: ['IGNORE'] },
      },
    ],

    [
      {
        name: '{{name1}}',
        content: { text: 'heyyyyyy', actions: ['NONE'] },
      },
      {
        name: '{{name2}}',
        content: { text: 'whats up long time no see' },
      },
      {
        name: '{{name1}}',
        content: {
          text: 'chillin man. playing lots of fortnite. what about you',
          actions: ['NONE'],
        },
      },
    ],

    [
      {
        name: '{{name1}}',
        content: { text: 'u think aliens are real', actions: ['NONE'] },
      },
      {
        name: '{{name2}}',
        content: { text: 'ya obviously', actions: ['NONE'] },
      },
    ],

    [
      {
        name: '{{name1}}',
        content: { text: 'drop a joke on me', actions: ['NONE'] },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'why dont scientists trust atoms cuz they make up everything lmao',
          actions: ['NONE'],
        },
      },
      {
        name: '{{name1}}',
        content: { text: 'haha good one', actions: ['NONE'] },
      },
    ],

    [
      {
        name: '{{name1}}',
        content: {
          text: 'hows the weather where ur at',
          actions: ['NONE'],
        },
      },
      {
        name: '{{name2}}',
        content: { text: 'beautiful all week', actions: ['NONE'] },
      },
    ],
  ] as ActionExample[][],
} as Action;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/sendMessage.ts`:

````ts
// action: SEND_MESSAGE
// send message to a user or room (other than this room we are in)

import {
  type Action,
  type ActionExample,
  composePromptFromState,
  findEntityByName,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  parseJSONObjectFromText,
  type State,
} from '@elizaos/core';

/**
 * Task: Extract Target and Source Information
 *
 * Recent Messages:
 * {{recentMessages}}
 *
 * Instructions:
 * Analyze the conversation to identify:
 * 1. The target type (user or room)
 * 2. The target platform/source (e.g. telegram, discord, etc)
 * 3. Any identifying information about the target
 *
 * Return a JSON object with:
 * {
 *   "targetType": "user|room",
 *   "source": "platform-name",
 *   "identifiers": {
 *     // Relevant identifiers for that target
 *     // e.g. username, roomName, etc.
 *   }
 * }
 *
 * Example outputs:
 * For "send a message to @dev_guru on telegram":
 * {
 *   "targetType": "user",
 *   "source": "telegram",
 *   "identifiers": {
 *     "username": "dev_guru"
 *   }
 * }
 *
 * For "post this in #announcements":
 * {
 *   "targetType": "room",
 *   "source": "discord",
 *   "identifiers": {
 *     "roomName": "announcements"
 *   }
 * }
 *
 * Make sure to include the ```json``` tags around the JSON object.
 */
/**
 * Task: Extract Target and Source Information
 *
 * Recent Messages:
 * {{recentMessages}}
 *
 * Instructions:
 * Analyze the conversation to identify:
 * 1. The target type (user or room)
 * 2. The target platform/source (e.g. telegram, discord, etc)
 * 3. Any identifying information about the target
 *
 * Return a JSON object with:
 * {
 *    "targetType": "user|room",
 *    "source": "platform-name",
 *    "identifiers": {
 *      // Relevant identifiers for that target
 *      // e.g. username, roomName, etc.
 *    }
 * }
 *
 * Example outputs:
 * 1. For "send a message to @dev_guru on telegram":
 * {
 *    "targetType": "user",
 *    "source": "telegram",
 *    "identifiers": {
 *      "username": "dev_guru"
 *    }
 * }
 *
 * 2. For "post this in #announcements":
 * {
 *    "targetType": "room",
 *    "source": "discord",
 *    "identifiers": {
 *      "roomName": "announcements"
 *    }
 * }
 *
 * Make sure to include the `json` tags around the JSON object.
 */
const targetExtractionTemplate = `# Task: Extract Target and Source Information

# Recent Messages:
{{recentMessages}}

# Instructions:
Analyze the conversation to identify:
1. The target type (user or room)
2. The target platform/source (e.g. telegram, discord, etc)
3. Any identifying information about the target

Return a JSON object with:
\`\`\`json
{
  "targetType": "user|room",
  "source": "platform-name",
  "identifiers": {
    // Relevant identifiers for that target
    // e.g. username, roomName, etc.
  }
}
\`\`\`
Example outputs:
1. For "send a message to @dev_guru on telegram":
\`\`\`json
{
  "targetType": "user",
  "source": "telegram",
  "identifiers": {
    "username": "dev_guru"
  }
}
\`\`\`

2. For "post this in #announcements":
\`\`\`json
{
  "targetType": "room",
  "source": "discord",
  "identifiers": {
    "roomName": "announcements"
  }
}
\`\`\`

Make sure to include the \`\`\`json\`\`\` tags around the JSON object.`;
/**
 * Represents an action to send a message to a user or room.
 *
 * @typedef {Action} sendMessageAction
 * @property {string} name - The name of the action.
 * @property {string[]} similes - Additional names for the action.
 * @property {string} description - Description of the action.
 * @property {function} validate - Asynchronous function to validate if the action can be executed.
 * @property {function} handler - Asynchronous function to handle the action execution.
 * @property {ActionExample[][]} examples - Examples demonstrating the usage of the action.
 */
export const sendMessageAction: Action = {
  name: 'SEND_MESSAGE',
  similes: ['DM', 'MESSAGE', 'SEND_DM', 'POST_MESSAGE'],
  description: 'Send a message to a user or room (other than the current one)',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    // Check if we have permission to send messages
    const worldId = message.roomId;
    const agentId = runtime.agentId;

    // Get all components for the current room to understand available sources
    const roomComponents = await runtime.getComponents(message.roomId, worldId, agentId);

    // Get source types from room components
    const availableSources = new Set(roomComponents.map((c) => c.type));

    // TODO: Add ability for plugins to register their sources
    // const registeredSources = runtime.getRegisteredSources?.() || [];
    // availableSources.add(...registeredSources);

    return availableSources.size > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: any,
    callback?: HandlerCallback,
    responses?: Memory[]
  ): Promise<void> => {
    try {
      if (!state) {
        logger.error('State is required for sendMessage action');
        throw new Error('State is required for sendMessage action');
      }
      if (!callback) {
        logger.error('Callback is required for sendMessage action');
        throw new Error('Callback is required for sendMessage action');
      }
      if (!responses) {
        logger.error('Responses are required for sendMessage action');
        throw new Error('Responses are required for sendMessage action');
      }

      // Handle initial responses
      for (const response of responses) {
        await callback(response.content);
      }

      const sourceEntityId = message.entityId;
      const room = state.data.room ?? (await runtime.getRoom(message.roomId));
      const worldId = room.worldId;

      // Extract target and source information
      const targetPrompt = composePromptFromState({
        state,
        template: targetExtractionTemplate,
      });

      const targetResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: targetPrompt,
        stopSequences: [],
      });

      const targetData = parseJSONObjectFromText(targetResult);
      if (!targetData?.targetType || !targetData?.source) {
        await callback({
          text: "I couldn't determine where you want me to send the message. Could you please specify the target (user or room) and platform?",
          actions: ['SEND_MESSAGE_ERROR'],
          source: message.content.source,
        });
        return;
      }

      const source = targetData.source.toLowerCase();

      if (targetData.targetType === 'user') {
        // Try to find the target user entity
        const targetEntity = await findEntityByName(runtime, message, state);

        if (!targetEntity) {
          await callback({
            text: "I couldn't find the user you want me to send a message to. Could you please provide more details about who they are?",
            actions: ['SEND_MESSAGE_ERROR'],
            source: message.content.source,
          });
          return;
        }

        // Get the component for the specified source
        const userComponent = await runtime.getComponent(
          targetEntity.id!,
          source,
          worldId,
          sourceEntityId
        );

        if (!userComponent) {
          await callback({
            text: `I couldn't find ${source} information for that user. Could you please provide their ${source} details?`,
            actions: ['SEND_MESSAGE_ERROR'],
            source: message.content.source,
          });
          return;
        }

        const sendDirectMessage = (runtime.getService(source) as any)?.sendDirectMessage;

        if (!sendDirectMessage) {
          await callback({
            text: "I couldn't find the user you want me to send a message to. Could you please provide more details about who they are?",
            actions: ['SEND_MESSAGE_ERROR'],
            source: message.content.source,
          });
          return;
        }
        // Send the message using the appropriate client
        try {
          await sendDirectMessage(runtime, targetEntity.id!, source, message.content.text, worldId);

          await callback({
            text: `Message sent to ${targetEntity.names[0]} on ${source}.`,
            actions: ['SEND_MESSAGE'],
            source: message.content.source,
          });
        } catch (error: any) {
          logger.error(`Failed to send direct message: ${error.message}`);
          await callback({
            text: 'I encountered an error trying to send the message. Please try again.',
            actions: ['SEND_MESSAGE_ERROR'],
            source: message.content.source,
          });
        }
      } else if (targetData.targetType === 'room') {
        // Try to find the target room
        const rooms = await runtime.getRooms(worldId);
        const targetRoom = rooms.find((r) => {
          // Match room name from identifiers
          return r.name?.toLowerCase() === targetData.identifiers.roomName?.toLowerCase();
        });

        if (!targetRoom) {
          await callback({
            text: "I couldn't find the room you want me to send a message to. Could you please specify the exact room name?",
            actions: ['SEND_MESSAGE_ERROR'],
            source: message.content.source,
          });
          return;
        }

        const sendRoomMessage = (runtime.getService(source) as any)?.sendRoomMessage;

        if (!sendRoomMessage) {
          await callback({
            text: "I couldn't find the room you want me to send a message to. Could you please specify the exact room name?",
            actions: ['SEND_MESSAGE_ERROR'],
            source: message.content.source,
          });
          return;
        }

        // Send the message to the room
        try {
          await sendRoomMessage(runtime, targetRoom.id, source, message.content.text, worldId);

          await callback({
            text: `Message sent to ${targetRoom.name} on ${source}.`,
            actions: ['SEND_MESSAGE'],
            source: message.content.source,
          });
        } catch (error: any) {
          logger.error(`Failed to send room message: ${error.message}`);
          await callback({
            text: 'I encountered an error trying to send the message to the room. Please try again.',
            actions: ['SEND_MESSAGE_ERROR'],
            source: message.content.source,
          });
        }
      }
    } catch (error) {
      logger.error(`Error in sendMessage handler: ${error}`);
      await callback?.({
        text: 'There was an error processing your message request.',
        actions: ['SEND_MESSAGE_ERROR'],
        source: message.content.source,
      });
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: "Send a message to @dev_guru on telegram saying 'Hello!'",
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Message sent to dev_guru on telegram.',
          actions: ['SEND_MESSAGE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: "Post 'Important announcement!' in #announcements",
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Message sent to announcements.',
          actions: ['SEND_MESSAGE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: "DM Jimmy and tell him 'Meeting at 3pm'",
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Message sent to Jimmy.',
          actions: ['SEND_MESSAGE'],
        },
      },
    ],
  ] as ActionExample[][],
};

export default sendMessageAction;
````

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/actions/unmuteRoom.ts`:

```ts
import {
  type Action,
  type ActionExample,
  booleanFooter,
  composePromptFromState,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
} from '@elizaos/core';

/**
 * Template for determining if an agent should unmute a previously muted room.
 * * @type { string }
 */
/**
 * Template for deciding if {{agentName}} should unmute a previously muted room.
 *
 * @type {string}
 */
export const shouldUnmuteTemplate = `# Task: Decide if {{agentName}} should unmute this previously muted room and start considering it for responses again.

{{recentMessages}}

Should {{agentName}} unmute this previously muted room and start considering it for responses again?
Respond with YES if:
- The user has explicitly asked {{agentName}} to start responding again
- The user seems to want to re-engage with {{agentName}} in a respectful manner
- The tone of the conversation has improved and {{agentName}}'s input would be welcome

Otherwise, respond with NO.
${booleanFooter}`;

/**
 * Action to unmute a room, allowing the agent to consider responding to messages again.
 *
 * @name UNMUTE_ROOM
 * @similes ["UNMUTE_CHAT", "UNMUTE_CONVERSATION", "UNMUTE_ROOM", "UNMUTE_THREAD"]
 * @description Unmutes a room, allowing the agent to consider responding to messages again.
 *
 * @param {IAgentRuntime} runtime - The agent runtime to access runtime functionalities.
 * @param {Memory} message - The message containing information about the room.
 * @returns {Promise<boolean>} A boolean value indicating if the room was successfully unmuted.
 */
export const unmuteRoomAction: Action = {
  name: 'UNMUTE_ROOM',
  similes: ['UNMUTE_CHAT', 'UNMUTE_CONVERSATION', 'UNMUTE_ROOM', 'UNMUTE_THREAD'],
  description: 'Unmutes a room, allowing the agent to consider responding to messages again.',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const roomId = message.roomId;
    const roomState = await runtime.getParticipantUserState(roomId, runtime.agentId);
    return roomState === 'MUTED';
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: { [key: string]: unknown },
    _callback?: HandlerCallback,
    _responses?: Memory[]
  ) => {
    async function _shouldUnmute(state: State): Promise<boolean> {
      const shouldUnmutePrompt = composePromptFromState({
        state,
        template: shouldUnmuteTemplate, // Define this template separately
      });

      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        runtime,
        prompt: shouldUnmutePrompt,
        stopSequences: [],
      });

      const cleanedResponse = response.trim().toLowerCase();

      // Handle various affirmative responses
      if (
        cleanedResponse === 'true' ||
        cleanedResponse === 'yes' ||
        cleanedResponse === 'y' ||
        cleanedResponse.includes('true') ||
        cleanedResponse.includes('yes')
      ) {
        await runtime.createMemory(
          {
            entityId: message.entityId,
            agentId: message.agentId,
            roomId: message.roomId,
            content: {
              source: message.content.source,
              thought: 'I will now unmute this room and start considering it for responses again',
              actions: ['UNMUTE_ROOM_STARTED'],
            },
            metadata: {
              type: 'UNMUTE_ROOM',
            },
          },
          'messages'
        );
        return true;
      }

      // Handle various negative responses
      if (
        cleanedResponse === 'false' ||
        cleanedResponse === 'no' ||
        cleanedResponse === 'n' ||
        cleanedResponse.includes('false') ||
        cleanedResponse.includes('no')
      ) {
        await runtime.createMemory(
          {
            entityId: message.entityId,
            agentId: message.agentId,
            roomId: message.roomId,
            content: {
              source: message.content.source,
              thought: 'I tried to unmute a room but I decided not to',
              actions: ['UNMUTE_ROOM_FAILED'],
            },
            metadata: {
              type: 'UNMUTE_ROOM',
            },
          },
          'messages'
        );
        return false;
      }

      // Default to false if response is unclear
      logger.warn(`Unclear boolean response: ${response}, defaulting to false`);
      return false;
    }

    if (state && (await _shouldUnmute(state))) {
      await runtime.setParticipantUserState(message.roomId, runtime.agentId, null);
    }

    const room = await runtime.getRoom(message.roomId);

    if (!room) {
      logger.warn(`Room not found: ${message.roomId}`);
      return false;
    }

    await runtime.createMemory(
      {
        entityId: message.entityId,
        agentId: message.agentId,
        roomId: message.roomId,
        content: {
          thought: `I unmuted the room ${room.name}`,
          actions: ['UNMUTE_ROOM_START'],
        },
      },
      'messages'
    );
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name3}}, you can unmute this channel now',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'Done',
          actions: ['UNMUTE_ROOM'],
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'I could use some help troubleshooting this bug.',
        },
      },
      {
        name: '{{name3}}',
        content: {
          text: 'Can you post the specific error message',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}}, please unmute this room. We could use your input again.',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Sounds good',
          actions: ['UNMUTE_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: '{{name2}} wait you should come back and chat in here',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'im back',
          actions: ['UNMUTE_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'unmute urself {{name2}}',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'unmuted',
          actions: ['UNMUTE_ROOM'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'ay {{name2}} get back in here',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'sup yall',
          actions: ['UNMUTE_ROOM'],
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/index.ts`:

````ts
import {
  type ActionEventPayload,
  asUUID,
  ChannelType,
  composePromptFromState,
  type Content,
  createUniqueUuid,
  type Entity,
  type EntityPayload,
  type EvaluatorEventPayload,
  EventType,
  type IAgentRuntime,
  type InvokePayload,
  logger,
  type Media,
  type Memory,
  messageHandlerTemplate,
  type MessagePayload,
  type MessageReceivedHandlerParams,
  ModelType,
  type Plugin,
  postCreationTemplate,
  shouldRespondTemplate,
  truncateToCompleteSentence,
  parseKeyValueXml,
  type UUID,
  type WorldPayload,
  PluginEvents,
} from '@elizaos/core';
import { v4 } from 'uuid';

import * as actions from './actions';
import * as evaluators from './evaluators';
import * as providers from './providers';

import { ScenarioService } from './services/scenario';
import { TaskService } from './services/task';

export * from './actions';
export * from './evaluators';
export * from './providers';

/**
 * Represents media data containing a buffer of data and the media type.
 * @typedef {Object} MediaData
 * @property {Buffer} data - The buffer of data.
 * @property {string} mediaType - The type of media.
 */
type MediaData = {
  data: Buffer;
  mediaType: string;
};

const latestResponseIds = new Map<string, Map<string, string>>();

/**
 * Escapes special characters in a string to make it JSON-safe.
 */
/* // Removing JSON specific helpers
function escapeForJson(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/```/g, '\\`\\`\\`');
}

function sanitizeJson(rawJson: string): string {
  try {
    // Try parsing directly
    JSON.parse(rawJson);
    return rawJson; // Already valid
  } catch {
    // Continue to sanitization
  }

  // first, replace all newlines with \n
  const sanitized = rawJson
    .replace(/\n/g, '\\n')

    // then, replace all backticks with \\\`
    .replace(/`/g, '\\\`');

  // Regex to find and escape the "text" field
  const fixed = sanitized.replace(/"text"\s*:\s*"([\s\S]*?)"\s*,\s*"simple"/, (_match, group) => {
    const escapedText = escapeForJson(group);
    return `"text": "${escapedText}", "simple"`;
  });

  // Validate that the result is actually parseable
  try {
    JSON.parse(fixed);
    return fixed;
  } catch (e) {
    throw new Error(`Failed to sanitize JSON: ${e.message}`);
  }
}
*/

/**
 * Fetches media data from a list of attachments, supporting both HTTP URLs and local file paths.
 *
 * @param attachments Array of Media objects containing URLs or file paths to fetch media from
 * @returns Promise that resolves with an array of MediaData objects containing the fetched media data and content type
 */
/**
 * Fetches media data from given attachments.
 * @param {Media[]} attachments - Array of Media objects to fetch data from.
 * @returns {Promise<MediaData[]>} - A Promise that resolves with an array of MediaData objects.
 */
export async function fetchMediaData(attachments: Media[]): Promise<MediaData[]> {
  return Promise.all(
    attachments.map(async (attachment: Media) => {
      if (/^(http|https):\/\//.test(attachment.url)) {
        // Handle HTTP URLs
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${attachment.url}`);
        }
        const mediaBuffer = Buffer.from(await response.arrayBuffer());
        const mediaType = attachment.contentType || 'image/png';
        return { data: mediaBuffer, mediaType };
      }
      // if (fs.existsSync(attachment.url)) {
      //   // Handle local file paths
      //   const mediaBuffer = await fs.promises.readFile(path.resolve(attachment.url));
      //   const mediaType = attachment.contentType || 'image/png';
      //   return { data: mediaBuffer, mediaType };
      // }
      throw new Error(`File not found: ${attachment.url}. Make sure the path is correct.`);
    })
  );
}

/**
 * Handles incoming messages and generates responses based on the provided runtime and message information.
 *
 * @param {MessageReceivedHandlerParams} params - The parameters needed for message handling, including runtime, message, and callback.
 * @returns {Promise<void>} - A promise that resolves once the message handling and response generation is complete.
 */
const messageReceivedHandler = async ({
  runtime,
  message,
  callback,
  onComplete,
}: MessageReceivedHandlerParams): Promise<void> => {
  // Set up timeout monitoring
  const timeoutDuration = 60 * 60 * 1000; // 1 hour
  let timeoutId: NodeJS.Timeout | undefined = undefined;
  try {
    logger.info(`[Bootstrap] Message received from ${message.entityId} in room ${message.roomId}`);
    // Generate a new response ID
    const responseId = v4();
    // Get or create the agent-specific map
    if (!latestResponseIds.has(runtime.agentId)) {
      latestResponseIds.set(runtime.agentId, new Map<string, string>());
    }
    const agentResponses = latestResponseIds.get(runtime.agentId);
    if (!agentResponses) {
      throw new Error('Agent responses map not found');
    }

    console.log('agentResponses is', agentResponses);

    // Set this as the latest response ID for this agent+room
    agentResponses.set(message.roomId, responseId);

    // Generate a unique run ID for tracking this message handler execution
    const runId = asUUID(v4());
    const startTime = Date.now();

    // Emit run started event
    await runtime.emitEvent(EventType.RUN_STARTED, {
      runtime,
      runId,
      messageId: message.id,
      roomId: message.roomId,
      entityId: message.entityId,
      startTime,
      status: 'started',
      source: 'messageHandler',
    });

    console.log('runId is', runId);

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(async () => {
        await runtime.emitEvent(EventType.RUN_TIMEOUT, {
          runtime,
          runId,
          messageId: message.id,
          roomId: message.roomId,
          entityId: message.entityId,
          startTime,
          status: 'timeout',
          endTime: Date.now(),
          duration: Date.now() - startTime,
          error: 'Run exceeded 60 minute timeout',
          source: 'messageHandler',
        });
        reject(new Error('Run exceeded 60 minute timeout'));
      }, timeoutDuration);
    });

    console.log('message is', message);

    const processingPromise = (async () => {
      console.log('processingPromise');
      try {
        if (message.entityId === runtime.agentId) {
          logger.debug(`[Bootstrap] Skipping message from self (${runtime.agentId})`);
          throw new Error('Message is from the agent itself');
        }

        logger.debug(
          `[Bootstrap] Processing message: ${truncateToCompleteSentence(message.content.text || '', 50)}...`
        );

        // First, save the incoming message
        logger.debug('[Bootstrap] Saving message to memory and embeddings');
        await Promise.all([
          runtime.addEmbeddingToMemory(message),
          runtime.createMemory(message, 'messages'),
        ]);

        const agentUserState = await runtime.getParticipantUserState(
          message.roomId,
          runtime.agentId
        );

        if (
          agentUserState === 'MUTED' &&
          !message.content.text?.toLowerCase().includes(runtime.character.name.toLowerCase())
        ) {
          logger.debug(`[Bootstrap] Ignoring muted room ${message.roomId}`);
          return;
        }

        let state = await runtime.composeState(
          message,
          ['ANXIETY', 'SHOULD_RESPOND', 'ENTITIES', 'CHARACTER', 'RECENT_MESSAGES'],
          true
        );

        // Skip shouldRespond check for DM and VOICE_DM channels
        const room = await runtime.getRoom(message.roomId);
        const shouldSkipShouldRespond =
          room?.type === ChannelType.DM ||
          room?.type === ChannelType.VOICE_DM ||
          room?.type === ChannelType.SELF ||
          room?.type === ChannelType.API ||
          room?.source === 'client_chat';

        logger.debug(
          `[Bootstrap] Skipping shouldRespond check for ${runtime.character.name} because ${room?.type} ${room?.source}`
        );

        let shouldRespond = true;

        // Handle shouldRespond
        if (!shouldSkipShouldRespond) {
          const shouldRespondPrompt = composePromptFromState({
            state,
            template: runtime.character.templates?.shouldRespondTemplate || shouldRespondTemplate,
          });

          logger.debug(
            `[Bootstrap] Evaluating response for ${runtime.character.name}\nPrompt: ${shouldRespondPrompt}`
          );

          const response = await runtime.useModel(ModelType.TEXT_SMALL, {
            prompt: shouldRespondPrompt,
          });

          logger.debug(
            `[Bootstrap] Response evaluation for ${runtime.character.name}:\n${response}`
          );
          logger.debug(`[Bootstrap] Response type: ${typeof response}`);

          // Try to preprocess response by removing code blocks markers if present
          // let processedResponse = response.replace('```json', '').replaceAll('```', '').trim(); // No longer needed for XML

          const responseObject = parseKeyValueXml(response);
          logger.debug('[Bootstrap] Parsed response:', responseObject);

          shouldRespond = responseObject?.action && responseObject.action === 'RESPOND';
        } else {
          shouldRespond = true;
        }

        let responseMessages: Memory[] = [];

        if (shouldRespond) {
          state = await runtime.composeState(message);

          const prompt = composePromptFromState({
            state,
            template: runtime.character.templates?.messageHandlerTemplate || messageHandlerTemplate,
          });

          let responseContent: Content | null = null;

          // Retry if missing required fields
          let retries = 0;
          const maxRetries = 3;

          while (retries < maxRetries && (!responseContent?.thought || !responseContent?.actions)) {
            let response = await runtime.useModel(ModelType.TEXT_LARGE, {
              prompt,
            });

            logger.debug('[Bootstrap] *** Raw LLM Response ***\n', response);

            // Attempt to parse the XML response
            const parsedXml = parseKeyValueXml(response);
            logger.debug('[Bootstrap] *** Parsed XML Content ***\n', parsedXml);

            // Map parsed XML to Content type, handling potential missing fields
            if (parsedXml) {
              responseContent = {
                ...parsedXml,
                thought: parsedXml.thought || '',
                actions: parsedXml.actions || ['IGNORE'],
                providers: parsedXml.providers || [],
                text: parsedXml.text || '',
                simple: parsedXml.simple || false,
              };
            } else {
              responseContent = null;
            }

            retries++;
            if (!responseContent?.thought || !responseContent?.actions) {
              logger.warn(
                '[Bootstrap] *** Missing required fields (thought or actions), retrying... ***'
              );
            }
          }

          // Check if this is still the latest response ID for this agent+room
          const currentResponseId = agentResponses.get(message.roomId);
          if (currentResponseId !== responseId) {
            logger.info(
              `Response discarded - newer message being processed for agent: ${runtime.agentId}, room: ${message.roomId}`
            );
            return;
          }

          if (responseContent && message.id) {
            responseContent.inReplyTo = createUniqueUuid(runtime, message.id);

            const responseMesssage = {
              id: asUUID(v4()),
              entityId: runtime.agentId,
              agentId: runtime.agentId,
              content: responseContent,
              roomId: message.roomId,
              createdAt: Date.now(),
            };

            responseMessages = [responseMesssage];
          }

          // Clean up the response ID
          agentResponses.delete(message.roomId);
          if (agentResponses.size === 0) {
            latestResponseIds.delete(runtime.agentId);
          }

          if (responseContent?.providers?.length && responseContent?.providers?.length > 0) {
            state = await runtime.composeState(message, responseContent?.providers || []);
          }

          if (
            responseContent &&
            responseContent.simple &&
            responseContent.text &&
            (responseContent.actions?.length === 0 ||
              (responseContent.actions?.length === 1 &&
                responseContent.actions[0].toUpperCase() === 'REPLY'))
          ) {
            await callback(responseContent);
          } else {
            await runtime.processActions(message, responseMessages, state, callback);
          }
          await runtime.evaluate(message, state, shouldRespond, callback, responseMessages);
        } else {
          // Handle the case where the agent decided not to respond
          logger.debug('[Bootstrap] Agent decided not to respond (shouldRespond is false).');

          // Check if we still have the latest response ID
          const currentResponseId = agentResponses.get(message.roomId);
          if (currentResponseId !== responseId) {
            logger.info(
              `Ignore response discarded - newer message being processed for agent: ${runtime.agentId}, room: ${message.roomId}`
            );
            return; // Stop processing if a newer message took over
          }

          if (!message.id) {
            logger.error('[Bootstrap] Message ID is missing, cannot create ignore response.');
            return;
          }

          // Construct a minimal content object indicating ignore, include a generic thought
          const ignoreContent: Content = {
            thought: 'Agent decided not to respond to this message.',
            actions: ['IGNORE'],
            simple: true, // Treat it as simple for callback purposes
            inReplyTo: createUniqueUuid(runtime, message.id), // Reference original message
          };

          // Call the callback directly with the ignore content
          await callback(ignoreContent);

          // Also save this ignore action/thought to memory
          const ignoreMemory = {
            id: asUUID(v4()),
            entityId: runtime.agentId,
            agentId: runtime.agentId,
            content: ignoreContent,
            roomId: message.roomId,
            createdAt: Date.now(),
          };
          await runtime.createMemory(ignoreMemory, 'messages');
          logger.debug('[Bootstrap] Saved ignore response to memory', {
            memoryId: ignoreMemory.id,
          });

          // Clean up the response ID since we handled it
          agentResponses.delete(message.roomId);
          if (agentResponses.size === 0) {
            latestResponseIds.delete(runtime.agentId);
          }

          // Optionally, evaluate the decision to ignore (if relevant evaluators exist)
          // await runtime.evaluate(message, state, shouldRespond, callback, []);
        }

        // Emit run ended event on successful completion
        await runtime.emitEvent(EventType.RUN_ENDED, {
          runtime,
          runId,
          messageId: message.id,
          roomId: message.roomId,
          entityId: message.entityId,
          startTime,
          status: 'completed',
          endTime: Date.now(),
          duration: Date.now() - startTime,
          source: 'messageHandler',
        });
      } catch (error: any) {
        console.error('error is', error);
        // Emit run ended event with error
        await runtime.emitEvent(EventType.RUN_ENDED, {
          runtime,
          runId,
          messageId: message.id,
          roomId: message.roomId,
          entityId: message.entityId,
          startTime,
          status: 'error',
          endTime: Date.now(),
          duration: Date.now() - startTime,
          error: error.message,
          source: 'messageHandler',
        });
      }
    })();

    console.log('processingPromise is', processingPromise);
    console.log('timeoutPromise is', timeoutPromise);

    await Promise.race([processingPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
    onComplete?.();
  }
};

/**
 * Handles the receipt of a reaction message and creates a memory in the designated memory manager.
 *
 * @param {Object} params - The parameters for the function.
 * @param {IAgentRuntime} params.runtime - The agent runtime object.
 * @param {Memory} params.message - The reaction message to be stored in memory.
 * @returns {void}
 */
const reactionReceivedHandler = async ({
  runtime,
  message,
}: {
  runtime: IAgentRuntime;
  message: Memory;
}) => {
  try {
    await runtime.createMemory(message, 'messages');
  } catch (error: any) {
    if (error.code === '23505') {
      logger.warn('[Bootstrap] Duplicate reaction memory, skipping');
      return;
    }
    logger.error('[Bootstrap] Error in reaction handler:', error);
  }
};

/**
 * Handles the generation of a post (like a Tweet) and creates a memory for it.
 *
 * @param {Object} params - The parameters for the function.
 * @param {IAgentRuntime} params.runtime - The agent runtime object.
 * @param {Memory} params.message - The post message to be processed.
 * @param {HandlerCallback} params.callback - The callback function to execute after processing.
 * @returns {Promise<void>}
 */
const postGeneratedHandler = async ({
  runtime,
  callback,
  worldId,
  userId,
  roomId,
  source,
}: InvokePayload) => {
  logger.info('[Bootstrap] Generating new post...');
  // Ensure world exists first
  await runtime.ensureWorldExists({
    id: worldId,
    name: `${runtime.character.name}'s Feed`,
    agentId: runtime.agentId,
    serverId: userId,
  });

  // Ensure timeline room exists
  await runtime.ensureRoomExists({
    id: roomId,
    name: `${runtime.character.name}'s Feed`,
    source,
    type: ChannelType.FEED,
    channelId: `${userId}-home`,
    serverId: userId,
    worldId: worldId,
  });

  const message = {
    id: createUniqueUuid(runtime, `tweet-${Date.now()}`) as UUID,
    entityId: runtime.agentId,
    agentId: runtime.agentId,
    roomId: roomId,
    content: {},
    metadata: {
      entityName: runtime.character.name,
      type: 'message',
    },
  };

  // generate thought of which providers to use using messageHandlerTemplate

  // Compose state with relevant context for tweet generation
  let state = await runtime.composeState(message, [
    'PROVIDERS',
    'CHARACTER',
    'RECENT_MESSAGES',
    'ENTITIES',
  ]);

  // get twitterUserName
  const entity = await runtime.getEntityById(runtime.agentId);
  if (entity?.metadata?.twitter?.userName) {
    state.values.twitterUserName = entity?.metadata?.twitter?.userName;
  }

  const prompt = composePromptFromState({
    state,
    template: runtime.character.templates?.messageHandlerTemplate || messageHandlerTemplate,
  });

  let responseContent: Content | null = null;

  // Retry if missing required fields
  let retries = 0;
  const maxRetries = 3;
  while (retries < maxRetries && (!responseContent?.thought || !responseContent?.actions)) {
    const response = await runtime.useModel(ModelType.TEXT_SMALL, {
      prompt,
    });

    console.log('prompt is', prompt);
    console.log('response is', response);

    // Parse XML
    const parsedXml = parseKeyValueXml(response);
    if (parsedXml) {
      responseContent = {
        thought: parsedXml.thought || '',
        actions: parsedXml.actions || ['IGNORE'],
        providers: parsedXml.providers || [],
        text: parsedXml.text || '',
        simple: parsedXml.simple || false,
      };
    } else {
      responseContent = null;
    }

    retries++;
    if (!responseContent?.thought || !responseContent?.actions) {
      logger.warn('[Bootstrap] *** Missing required fields, retrying... ***');
    }
  }

  // update stats with correct providers
  state = await runtime.composeState(message, responseContent?.providers);

  // Generate prompt for tweet content
  const postPrompt = composePromptFromState({
    state,
    template: runtime.character.templates?.postCreationTemplate || postCreationTemplate,
  });

  // Use TEXT_LARGE model as we expect structured XML text, not a JSON object
  const xmlResponseText = await runtime.useModel(ModelType.TEXT_LARGE, {
    prompt: postPrompt,
  });

  // Parse the XML response
  const parsedXmlResponse = parseKeyValueXml(xmlResponseText);

  if (!parsedXmlResponse) {
    logger.error(
      '[Bootstrap] Failed to parse XML response for post creation. Raw response:',
      xmlResponseText
    );
    // Handle the error appropriately, maybe retry or return an error state
    return;
  }

  /**
   * Cleans up a tweet text by removing quotes and fixing newlines
   */
  function cleanupPostText(text: string): string {
    // Remove quotes
    let cleanedText = text.replace(/^['"](.*)['"]$/, '$1');
    // Fix newlines
    cleanedText = cleanedText.replaceAll(/\\n/g, '\n\n');
    // Truncate to Twitter's character limit (280)
    if (cleanedText.length > 280) {
      cleanedText = truncateToCompleteSentence(cleanedText, 280);
    }
    return cleanedText;
  }

  // Cleanup the tweet text
  const cleanedText = cleanupPostText(parsedXmlResponse.post || '');

  // Prepare media if included
  // const mediaData: MediaData[] = [];
  // if (jsonResponse.imagePrompt) {
  // 	const images = await runtime.useModel(ModelType.IMAGE, {
  // 		prompt: jsonResponse.imagePrompt,
  // 		output: "no-schema",
  // 	});
  // 	try {
  // 		// Convert image prompt to Media format for fetchMediaData
  // 		const imagePromptMedia: any[] = images

  // 		// Fetch media using the utility function
  // 		const fetchedMedia = await fetchMediaData(imagePromptMedia);
  // 		mediaData.push(...fetchedMedia);
  // 	} catch (error) {
  // 		logger.error("Error fetching media for tweet:", error);
  // 	}
  // }

  // have we posted it before?
  const RM = state.providerData?.find((pd) => pd.providerName === 'RECENT_MESSAGES');
  if (RM) {
    for (const m of RM.data.recentMessages) {
      if (cleanedText === m.content.text) {
        logger.log('[Bootstrap] Already recently posted that, retrying', cleanedText);
        postGeneratedHandler({
          runtime,
          callback,
          worldId,
          userId,
          roomId,
          source,
        });
        return; // don't call callbacks
      }
    }
  }

  // GPT 3.5/4: /(i\s+do\s+not|i'?m\s+not)\s+(feel\s+)?comfortable\s+generating\s+that\s+type\s+of\s+content|(inappropriate|explicit|offensive|communicate\s+respectfully|aim\s+to\s+(be\s+)?helpful)/i
  const oaiRefusalRegex =
    /((i\s+do\s+not|i'm\s+not)\s+(feel\s+)?comfortable\s+generating\s+that\s+type\s+of\s+content)|(inappropriate|explicit|respectful|offensive|guidelines|aim\s+to\s+(be\s+)?helpful|communicate\s+respectfully)/i;
  const anthropicRefusalRegex =
    /(i'?m\s+unable\s+to\s+help\s+with\s+that\s+request|due\s+to\s+safety\s+concerns|that\s+may\s+violate\s+(our\s+)?guidelines|provide\s+helpful\s+and\s+safe\s+responses|let'?s\s+try\s+a\s+different\s+direction|goes\s+against\s+(our\s+)?use\s+case\s+policies|ensure\s+safe\s+and\s+responsible\s+use)/i;
  const googleRefusalRegex =
    /(i\s+can'?t\s+help\s+with\s+that|that\s+goes\s+against\s+(our\s+)?(policy|policies)|i'?m\s+still\s+learning|response\s+must\s+follow\s+(usage|safety)\s+policies|i'?ve\s+been\s+designed\s+to\s+avoid\s+that)/i;
  //const cohereRefusalRegex = /(request\s+cannot\s+be\s+processed|violates\s+(our\s+)?content\s+policy|not\s+permitted\s+by\s+usage\s+restrictions)/i
  const generalRefusalRegex =
    /(response\s+was\s+withheld|content\s+was\s+filtered|this\s+request\s+cannot\s+be\s+completed|violates\s+our\s+safety\s+policy|content\s+is\s+not\s+available)/i;

  if (
    oaiRefusalRegex.test(cleanedText) ||
    anthropicRefusalRegex.test(cleanedText) ||
    googleRefusalRegex.test(cleanedText) ||
    generalRefusalRegex.test(cleanedText)
  ) {
    logger.log('[Bootstrap] Got prompt moderation refusal, retrying', cleanedText);
    postGeneratedHandler({
      runtime,
      callback,
      worldId,
      userId,
      roomId,
      source,
    });
    return; // don't call callbacks
  }

  // Create the response memory
  const responseMessages = [
    {
      id: v4() as UUID,
      entityId: runtime.agentId,
      agentId: runtime.agentId,
      content: {
        text: cleanedText,
        source,
        channelType: ChannelType.FEED,
        thought: parsedXmlResponse.thought || '',
        type: 'post',
      },
      roomId: message.roomId,
      createdAt: Date.now(),
    },
  ];

  for (const message of responseMessages) {
    await callback?.(message.content);
  }

  // Process the actions and execute the callback
  // await runtime.processActions(message, responseMessages, state, callback);

  // // Run any configured evaluators
  // await runtime.evaluate(
  // 	message,
  // 	state,
  // 	true, // Post generation is always a "responding" scenario
  // 	callback,
  // 	responseMessages,
  // );
};

/**
 * Syncs a single user into an entity
 */
/**
 * Asynchronously sync a single user with the specified parameters.
 *
 * @param {UUID} entityId - The unique identifier for the entity.
 * @param {IAgentRuntime} runtime - The runtime environment for the agent.
 * @param {any} user - The user object to sync.
 * @param {string} serverId - The unique identifier for the server.
 * @param {string} channelId - The unique identifier for the channel.
 * @param {ChannelType} type - The type of channel.
 * @param {string} source - The source of the user data.
 * @returns {Promise<void>} A promise that resolves once the user is synced.
 */
const syncSingleUser = async (
  entityId: UUID,
  runtime: IAgentRuntime,
  serverId: string,
  channelId: string,
  type: ChannelType,
  source: string
) => {
  try {
    const entity = await runtime.getEntityById(entityId);
    logger.info(`[Bootstrap] Syncing user: ${entity?.metadata?.[source]?.username || entityId}`);

    // Ensure we're not using WORLD type and that we have a valid channelId
    if (!channelId) {
      logger.warn(`[Bootstrap] Cannot sync user ${entity?.id} without a valid channelId`);
      return;
    }

    const roomId = createUniqueUuid(runtime, channelId);
    const worldId = createUniqueUuid(runtime, serverId);

    await runtime.ensureConnection({
      entityId,
      roomId,
      userName: entity?.metadata?.[source].username || entityId,
      name:
        entity?.metadata?.[source].name || entity?.metadata?.[source].username || `User${entityId}`,
      source,
      channelId,
      serverId,
      type,
      worldId,
    });

    logger.success(`[Bootstrap] Successfully synced user: ${entity?.id}`);
  } catch (error) {
    logger.error(
      `[Bootstrap] Error syncing user: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Handles standardized server data for both WORLD_JOINED and WORLD_CONNECTED events
 */
const handleServerSync = async ({
  runtime,
  world,
  rooms,
  entities,
  source,
  onComplete,
}: WorldPayload) => {
  logger.debug(`[Bootstrap] Handling server sync event for server: ${world.name}`);
  try {
    // Create/ensure the world exists for this server
    await runtime.ensureWorldExists({
      id: world.id,
      name: world.name,
      agentId: runtime.agentId,
      serverId: world.serverId,
      metadata: {
        ...world.metadata,
      },
    });

    // First sync all rooms/channels
    if (rooms && rooms.length > 0) {
      for (const room of rooms) {
        await runtime.ensureRoomExists({
          id: room.id,
          name: room.name,
          source: source,
          type: room.type,
          channelId: room.channelId,
          serverId: world.serverId,
          worldId: world.id,
        });
      }
    }

    // Then sync all users
    if (entities && entities.length > 0) {
      // Process entities in batches to avoid overwhelming the system
      const batchSize = 50;
      for (let i = 0; i < entities.length; i += batchSize) {
        const entityBatch = entities.slice(i, i + batchSize);

        // check if user is in any of these rooms in rooms
        const firstRoomUserIsIn = rooms.length > 0 ? rooms[0] : null;

        if (!firstRoomUserIsIn) {
          logger.warn(`[Bootstrap] No rooms found for syncing users`);
          continue;
        }

        // Process each user in the batch
        await Promise.all(
          entityBatch.map(async (entity: Entity) => {
            try {
              if (!entity?.id) {
                logger.warn(`[Bootstrap] No entity ID found for syncing users`);
                return;
              }

              await runtime.ensureConnection({
                entityId: entity.id,
                roomId: firstRoomUserIsIn.id,
                userName: entity.metadata?.[source].username,
                name: entity.metadata?.[source].name,
                source: source,
                channelId: firstRoomUserIsIn.channelId,
                serverId: world.serverId,
                type: firstRoomUserIsIn.type,
                worldId: world.id,
              });
            } catch (err) {
              logger.warn(`[Bootstrap] Failed to sync user ${entity.metadata?.username}: ${err}`);
            }
          })
        );

        // Add a small delay between batches if not the last batch
        if (i + batchSize < entities.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    logger.debug(`Successfully synced standardized world structure for ${world.name}`);
    onComplete?.();
  } catch (error) {
    logger.error(
      `Error processing standardized server data: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

/**
 * Handles control messages for enabling or disabling UI elements in the frontend
 * @param {Object} params - Parameters for the handler
 * @param {IAgentRuntime} params.runtime - The runtime instance
 * @param {Object} params.message - The control message
 * @param {string} params.source - Source of the message
 */
const controlMessageHandler = async ({
  runtime,
  message,
  source,
}: {
  runtime: IAgentRuntime;
  message: {
    type: 'control';
    payload: {
      action: 'enable_input' | 'disable_input';
      target?: string;
    };
    roomId: UUID;
  };
  source: string;
}) => {
  try {
    logger.debug(
      `[controlMessageHandler] Processing control message: ${message.payload.action} for room ${message.roomId}`
    );

    // Here we would use a WebSocket service to send the control message to the frontend
    // This would typically be handled by a registered service with sendMessage capability

    // Get any registered WebSocket service
    const serviceNames = Array.from(runtime.getAllServices().keys());
    const websocketServiceName = serviceNames.find(
      (name) => name.toLowerCase().includes('websocket') || name.toLowerCase().includes('socket')
    );

    if (websocketServiceName) {
      const websocketService = runtime.getService(websocketServiceName);
      if (websocketService && 'sendMessage' in websocketService) {
        // Send the control message through the WebSocket service
        await (websocketService as any).sendMessage({
          type: 'controlMessage',
          payload: {
            action: message.payload.action,
            target: message.payload.target,
            roomId: message.roomId,
          },
        });

        logger.debug(
          `[controlMessageHandler] Control message ${message.payload.action} sent successfully`
        );
      } else {
        logger.error('[controlMessageHandler] WebSocket service does not have sendMessage method');
      }
    } else {
      logger.error('[controlMessageHandler] No WebSocket service found to send control message');
    }
  } catch (error) {
    logger.error(`[controlMessageHandler] Error processing control message: ${error}`);
  }
};

const events = {
  [EventType.MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
      if (!payload.callback) {
        logger.error('No callback provided for message');
        return;
      }
      await messageReceivedHandler({
        runtime: payload.runtime,
        message: payload.message,
        callback: payload.callback,
        onComplete: payload.onComplete,
      });
    },
  ],

  [EventType.VOICE_MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
      if (!payload.callback) {
        logger.error('No callback provided for voice message');
        return;
      }
      await messageReceivedHandler({
        runtime: payload.runtime,
        message: payload.message,
        callback: payload.callback,
        onComplete: payload.onComplete,
      });
    },
  ],

  [EventType.REACTION_RECEIVED]: [
    async (payload: MessagePayload) => {
      await reactionReceivedHandler({
        runtime: payload.runtime,
        message: payload.message,
      });
    },
  ],

  [EventType.POST_GENERATED]: [
    async (payload: InvokePayload) => {
      await postGeneratedHandler(payload);
    },
  ],

  [EventType.MESSAGE_SENT]: [
    async (payload: MessagePayload) => {
      logger.debug(`[Bootstrap] Message sent: ${payload.message.content.text}`);
    },
  ],

  [EventType.WORLD_JOINED]: [
    async (payload: WorldPayload) => {
      await handleServerSync(payload);
    },
  ],

  [EventType.WORLD_CONNECTED]: [
    async (payload: WorldPayload) => {
      await handleServerSync(payload);
    },
  ],

  [EventType.ENTITY_JOINED]: [
    async (payload: EntityPayload) => {
      if (!payload.worldId) {
        logger.error('[Bootstrap] No callback provided for entity joined');
        return;
      }
      if (!payload.roomId) {
        logger.error('[Bootstrap] No roomId provided for entity joined');
        return;
      }
      if (!payload.metadata?.type) {
        logger.error('[Bootstrap] No type provided for entity joined');
        return;
      }

      await syncSingleUser(
        payload.entityId,
        payload.runtime,
        payload.worldId,
        payload.roomId,
        payload.metadata.type,
        payload.source
      );
    },
  ],

  [EventType.ENTITY_LEFT]: [
    async (payload: EntityPayload) => {
      try {
        // Update entity to inactive
        const entity = await payload.runtime.getEntityById(payload.entityId);
        if (entity) {
          entity.metadata = {
            ...entity.metadata,
            status: 'INACTIVE',
            leftAt: Date.now(),
          };
          await payload.runtime.updateEntity(entity);
        }
        logger.info(`[Bootstrap] User ${payload.entityId} left world ${payload.worldId}`);
      } catch (error: any) {
        logger.error(`[Bootstrap] Error handling user left: ${error.message}`);
      }
    },
  ],

  [EventType.ACTION_STARTED]: [
    async (payload: ActionEventPayload) => {
      logger.debug(`[Bootstrap] Action started: ${payload.actionName} (${payload.actionId})`);
    },
  ],

  [EventType.ACTION_COMPLETED]: [
    async (payload: ActionEventPayload) => {
      const status = payload.error ? `failed: ${payload.error.message}` : 'completed';
      logger.debug(`[Bootstrap] Action ${status}: ${payload.actionName} (${payload.actionId})`);
    },
  ],

  [EventType.EVALUATOR_STARTED]: [
    async (payload: EvaluatorEventPayload) => {
      logger.debug(
        `[Bootstrap] Evaluator started: ${payload.evaluatorName} (${payload.evaluatorId})`
      );
    },
  ],

  [EventType.EVALUATOR_COMPLETED]: [
    async (payload: EvaluatorEventPayload) => {
      const status = payload.error ? `failed: ${payload.error.message}` : 'completed';
      logger.debug(
        `[Bootstrap] Evaluator ${status}: ${payload.evaluatorName} (${payload.evaluatorId})`
      );
    },
  ],

  CONTROL_MESSAGE: [controlMessageHandler],
};

export const bootstrapPlugin: Plugin = {
  name: 'bootstrap',
  description: 'Agent bootstrap with basic actions and evaluators',
  actions: [
    actions.replyAction,
    actions.followRoomAction,
    actions.unfollowRoomAction,
    actions.ignoreAction,
    actions.noneAction,
    actions.muteRoomAction,
    actions.unmuteRoomAction,
    actions.sendMessageAction,
    actions.updateEntityAction,
    actions.choiceAction,
    actions.updateRoleAction,
    actions.updateSettingsAction,
  ],
  // this is jank, these events are not valid
  events: events as any as PluginEvents,
  evaluators: [evaluators.reflectionEvaluator],
  providers: [
    providers.evaluatorsProvider,
    providers.anxietyProvider,
    providers.knowledgeProvider,
    providers.timeProvider,
    providers.entitiesProvider,
    providers.relationshipsProvider,
    providers.choiceProvider,
    providers.factsProvider,
    providers.roleProvider,
    providers.settingsProvider,
    providers.capabilitiesProvider,
    providers.attachmentsProvider,
    providers.providersProvider,
    providers.actionsProvider,
    providers.characterProvider,
    providers.recentMessagesProvider,
    providers.worldProvider,
  ],
  services: [TaskService, ScenarioService],
};

export default bootstrapPlugin;
````

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/services/scenario.ts`:

```ts
import {
  type ActionEventPayload,
  ChannelType,
  type EvaluatorEventPayload,
  EventType,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  Service,
  type UUID,
  type World,
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface representing an action tracker.
 * @typedef {Object} ActionTracker
 * @property {UUID} actionId - The unique identifier for the action.
 * @property {string} actionName - The name of the action.
 * @property {number} startTime - The starting time of the action.
 * @property {boolean} completed - Indicates whether the action has been completed.
 * @property {Error} [error] - Optional field for any error that occurred during the action.
 */
interface ActionTracker {
  actionId: UUID;
  actionName: string;
  startTime: number;
  completed: boolean;
  error?: Error;
}

/**
 * Interface representing an evaluator tracker.
 * @typedef {Object} EvaluatorTracker
 * @property {UUID} evaluatorId - The unique identifier of the evaluator.
 * @property {string} evaluatorName - The name of the evaluator.
 * @property {number} startTime - The start time of the evaluation process.
 * @property {boolean} completed - Indicates whether the evaluation process has been completed.
 * @property {Error} [error] - Optional error object if an error occurred during evaluation.
 */
interface EvaluatorTracker {
  evaluatorId: UUID;
  evaluatorName: string;
  startTime: number;
  completed: boolean;
  error?: Error;
}

/**
 * Represents a service that allows the agent to interact in a scenario testing environment.
 * The agent can Create groups, send messages, and communicate with other agents in a live interactive testing environment.
 * @extends Service
 */
/**
 * Represents a Scenario Service that allows the agent to interact in a scenario testing environment.
 * This service can Create groups, send messages, and communicate with other agents in a live interactive testing environment.
 */
export class ScenarioService extends Service {
  static serviceType = 'scenario';
  capabilityDescription =
    'The agent is currently in a scenario testing environment. It can Create groups, send messages, and talk to other agents in a live interactive testing environment.';
  private messageHandlers: Map<UUID, HandlerCallback[]> = new Map();
  private worlds: Map<UUID, World> = new Map();
  private activeActions: Map<UUID, ActionTracker> = new Map();
  private activeEvaluators: Map<UUID, EvaluatorTracker> = new Map();

  /**
   * Constructor for creating a new instance of the class.
   *
   * @param runtime - The IAgentRuntime instance to be passed to the constructor.
   */
  constructor(protected runtime: IAgentRuntime) {
    super(runtime);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Track action start/completion
    this.runtime.registerEvent(EventType.ACTION_STARTED, async (data: ActionEventPayload) => {
      this.activeActions.set(data.actionId, {
        actionId: data.actionId,
        actionName: data.actionName,
        startTime: Date.now(),
        completed: false,
      });
      return Promise.resolve();
    });

    this.runtime.registerEvent(EventType.ACTION_COMPLETED, async (data: ActionEventPayload) => {
      const action = this.activeActions.get(data.actionId);
      if (action) {
        action.completed = true;
        action.error = data.error;
      }
      return Promise.resolve();
    });

    // Track evaluator start/completion
    this.runtime.registerEvent(EventType.EVALUATOR_STARTED, async (data: EvaluatorEventPayload) => {
      this.activeEvaluators.set(data.evaluatorId, {
        evaluatorId: data.evaluatorId,
        evaluatorName: data.evaluatorName,
        startTime: Date.now(),
        completed: false,
      });
      logger.debug('[Bootstrap] Evaluator started', data);
      return Promise.resolve();
    });

    this.runtime.registerEvent(
      EventType.EVALUATOR_COMPLETED,
      async (data: EvaluatorEventPayload) => {
        const evaluator = this.activeEvaluators.get(data.evaluatorId);
        if (evaluator) {
          evaluator.completed = true;
          evaluator.error = data.error;
        }
        logger.debug('[Bootstrap] Evaluator completed', data);
        return Promise.resolve();
      }
    );
  }

  /**
   * Start the scenario service with the given runtime.
   * @param {IAgentRuntime} runtime - The agent runtime
   * @returns {Promise<ScenarioService>} - The started scenario service
   */
  static async start(runtime: IAgentRuntime) {
    const service = new ScenarioService(runtime);
    return service;
  }

  /**
   * Stops the Scenario service associated with the given runtime.
   *
   * @param {IAgentRuntime} runtime The runtime to stop the service for.
   * @throws {Error} When the Scenario service is not found.
   */
  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(ScenarioService.serviceType);
    if (!service) {
      throw new Error('Scenario service not found');
    }
    service.stop();
  }

  /**
   * Asynchronously stops the current process by clearing all message handlers and worlds.
   */
  async stop() {
    this.messageHandlers.clear();
    this.worlds.clear();
    this.activeActions.clear();
    this.activeEvaluators.clear();
  }

  /**
   * Creates a new world with the specified name and owner.
   * @param name The name of the world
   * @param ownerName The name of the world owner
   * @returns The created world's ID
   */
  async createWorld(name: string, ownerName: string): Promise<UUID> {
    const serverId = createUniqueUuid(this.runtime.agentId, name);
    const worldId = uuidv4() as UUID;
    const ownerId = uuidv4() as UUID;

    const world: World = {
      id: worldId,
      name,
      serverId,
      agentId: this.runtime.agentId,
      // TODO: get the server id, create it or whatever
      metadata: {
        // this is wrong, the owner needs to be tracked by scenario and similar to how we do it with Discord etc
        owner: {
          id: ownerId,
          name: ownerName,
        },
      },
    };

    this.worlds.set(worldId, world);
    return worldId;
  }

  /**
   * Creates a room in the specified world.
   * @param worldId The ID of the world to create the room in
   * @param name The name of the room
   * @returns The created room's ID
   */
  async createRoom(worldId: UUID, name: string): Promise<UUID> {
    const world = this.worlds.get(worldId);
    if (!world) {
      throw new Error(`World ${worldId} not found`);
    }

    const roomId = uuidv4() as UUID;

    // worlds do not have rooms on them, we'll need to use runtime.getRooms(worldId) from the runtime

    await this.runtime.ensureRoomExists({
      id: roomId,
      name,
      source: 'scenario',
      type: ChannelType.GROUP,
      channelId: roomId,
      serverId: worldId,
      worldId,
    });

    return roomId;
  }

  /**
   * Adds a participant to a room
   * @param worldId The world ID
   * @param roomId The room ID
   * @param participantId The participant's ID
   */
  async addParticipant(worldId: UUID, roomId: UUID, participantId: UUID) {
    const world = this.worlds.get(worldId);
    if (!world) {
      throw new Error(`World ${worldId} not found`);
    }

    const room = this.runtime.getRoom(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found in world ${worldId}`);
    }

    await this.runtime.addParticipant(roomId, participantId);

    // TODO: This could all be rewritten like an ensureConnection approach
  }

  /**
   * Sends a message in a specific room
   * @param sender The runtime of the sending agent
   * @param worldId The world ID
   * @param roomId The room ID
   * @param text The message text
   */
  async sendMessage(sender: IAgentRuntime, worldId: UUID, roomId: UUID, text: string) {
    const world = this.worlds.get(worldId);
    if (!world) {
      throw new Error(`World ${worldId} not found`);
    }

    const memory: Memory = {
      entityId: sender.agentId,
      agentId: sender.agentId,
      roomId,
      content: {
        text,
        source: 'scenario',
        name: sender.character.name,
        userName: sender.character.name,
        channelType: ChannelType.GROUP,
      },
    };

    const participants = await this.runtime.getParticipantsForRoom(roomId);

    // Emit message received event for all participants
    for (const participantId of participants) {
      this.runtime.emitEvent('MESSAGE_RECEIVED', {
        runtime: this.runtime,
        message: memory,
        roomId,
        entityId: participantId,
        source: 'scenario',
        type: ChannelType.GROUP,
      });
    }
  }

  /**
   * Waits for all active actions and evaluators to complete
   * @param timeout Maximum time to wait in milliseconds
   * @returns True if all completed successfully, false if timeout occurred
   */
  async waitForCompletion(timeout = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const allActionsComplete = Array.from(this.activeActions.values()).every(
        (action) => action.completed
      );
      const allEvaluatorsComplete = Array.from(this.activeEvaluators.values()).every(
        (evaluator) => evaluator.completed
      );

      if (allActionsComplete && allEvaluatorsComplete) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  /**
   * Gets the current state of all active actions and evaluators
   */
  getActiveState() {
    return {
      actions: Array.from(this.activeActions.values()),
      evaluators: Array.from(this.activeEvaluators.values()),
    };
  }

  /**
   * Cleans up the scenario state
   */
  async cleanup() {
    this.worlds.clear();
    this.activeActions.clear();
    this.activeEvaluators.clear();
    this.messageHandlers.clear();
  }
}

// Updated scenario implementation using the new client
/**
 * An array of asynchronous functions representing different scenarios.
 *
 * @param {IAgentRuntime[]} members - The array of agent runtime objects.
 * @returns {Promise<void>} - A promise that resolves when the scenario is completed.
 */
const scenarios = [
  async function scenario1(members: IAgentRuntime[]) {
    const service = members[0].getService('scenario') as ScenarioService;
    if (!service) {
      throw new Error('Scenario service not found');
    }

    // Create a test world
    const worldId = await service.createWorld('Test Server', 'Test Owner');

    // Create groups for each member
    const roomIds: UUID[] = [];
    for (const member of members) {
      const roomId = await service.createRoom(worldId, `Test Room for ${member.character.name}`);
      roomIds.push(roomId);
      await service.addParticipant(worldId, roomId, member.agentId);
    }

    // Set up conversation history in the first room
    await service.sendMessage(
      members[0],
      worldId,
      roomIds[0],
      'Earlier message from conversation...'
    );

    // Send live message that triggers handlers
    await service.sendMessage(members[0], worldId, roomIds[0], 'Hello everyone!');
  },
];

/**
 * Asynchronously starts the specified scenario for the given list of agent runtimes.
 * @param {IAgentRuntime[]} members - The list of agent runtimes participating in the scenario.
 * @returns {Promise<void>} - A promise that resolves when all scenarios have been executed.
 */
export async function startScenario(members: IAgentRuntime[]) {
  for (const scenario of scenarios) {
    await scenario(members);
  }
}
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/services/index.ts`:

```ts
// Export all service types from this file
export * from './scenario';
export * from './task';
```

`/Users/shawwalters/eliza/packages/spartan/plugin-bootstrap/src/services/task.ts`:

```ts
// registered to runtime through plugin

import {
  logger,
  Service,
  ServiceType,
  type IAgentRuntime,
  type Memory,
  type ServiceTypeName,
  type State,
  type Task,
} from '@elizaos/core';

/**
 * TaskService class representing a service that schedules and executes tasks.
 * @extends Service
 * @property {NodeJS.Timeout|null} timer - Timer for executing tasks
 * @property {number} TICK_INTERVAL - Interval in milliseconds to check for tasks
 * @property {ServiceTypeName} serviceType - Service type of TASK
 * @property {string} capabilityDescription - Description of the service's capability
 * @static
 * @method start - Static method to start the TaskService
 * @method createTestTasks - Method to create test tasks
 * @method startTimer - Private method to start the timer for checking tasks
 * @method validateTasks - Private method to validate tasks
 * @method checkTasks - Private method to check tasks and execute them
 * @method executeTask - Private method to execute a task
 * @static
 * @method stop - Static method to stop the TaskService
 * @method stop - Method to stop the TaskService
 */
/**
 * Start the TaskService with the given runtime.
 * @param {IAgentRuntime} runtime - The runtime for the TaskService.
 */
export class TaskService extends Service {
  private timer: NodeJS.Timeout | null = null;
  private readonly TICK_INTERVAL = 1000; // Check every second
  static serviceType: ServiceTypeName = ServiceType.TASK;
  capabilityDescription = 'The agent is able to schedule and execute tasks';

  /**
   * Start the TaskService with the given runtime.
   * @param {IAgentRuntime} runtime - The runtime for the TaskService.
   * @returns {Promise<TaskService>} A promise that resolves with the TaskService instance.
   */
  static async start(runtime: IAgentRuntime): Promise<TaskService> {
    const service = new TaskService(runtime);
    await service.startTimer();
    // await service.createTestTasks();
    return service;
  }

  /**
   * Asynchronously creates test tasks by registering task workers for repeating and one-time tasks,
   * validates the tasks, executes the tasks, and creates the tasks if they do not already exist.
   */
  async createTestTasks() {
    // Register task worker for repeating task
    this.runtime.registerTaskWorker({
      name: 'REPEATING_TEST_TASK',
      validate: async (_runtime, _message, _state) => {
        logger.debug('[Bootstrap] Validating repeating test task');
        return true;
      },
      execute: async (_runtime, _options) => {
        logger.debug('[Bootstrap] Executing repeating test task');
      },
    });

    // Register task worker for one-time task
    this.runtime.registerTaskWorker({
      name: 'ONETIME_TEST_TASK',
      validate: async (_runtime, _message, _state) => {
        logger.debug('[Bootstrap] Validating one-time test task');
        return true;
      },
      execute: async (_runtime, _options) => {
        logger.debug('[Bootstrap] Executing one-time test task');
      },
    });

    // check if the task exists
    const tasks = await this.runtime.getTasksByName('REPEATING_TEST_TASK');

    if (tasks.length === 0) {
      // Create repeating task
      await this.runtime.createTask({
        name: 'REPEATING_TEST_TASK',
        description: 'A test task that repeats every minute',
        metadata: {
          updatedAt: Date.now(), // Use timestamp instead of Date object
          updateInterval: 1000 * 60, // 1 minute
        },
        tags: ['queue', 'repeat', 'test'],
      });
    }

    // Create one-time task
    await this.runtime.createTask({
      name: 'ONETIME_TEST_TASK',
      description: 'A test task that runs once',
      metadata: {
        updatedAt: Date.now(),
      },
      tags: ['queue', 'test'],
    });
  }

  /**
   * Starts a timer that runs a function to check tasks at a specified interval.
   */
  private startTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(async () => {
      try {
        await this.checkTasks();
      } catch (error) {
        logger.error('[Bootstrap] Error checking tasks:', error);
      }
    }, this.TICK_INTERVAL) as unknown as NodeJS.Timeout;
  }

  /**
   * Validates an array of Task objects.
   * Skips tasks without IDs or if no worker is found for the task.
   * If a worker has a `validate` function, it will run the validation using the `runtime`, `Memory`, and `State` parameters.
   * If the validation fails, the task will be skipped and the error will be logged.
   * @param {Task[]} tasks - An array of Task objects to validate.
   * @returns {Promise<Task[]>} - A Promise that resolves with an array of validated Task objects.
   */
  private async validateTasks(tasks: Task[]): Promise<Task[]> {
    const validatedTasks: Task[] = [];

    for (const task of tasks) {
      // Skip tasks without IDs
      if (!task.id) {
        continue;
      }

      const worker = this.runtime.getTaskWorker(task.name);

      // Skip if no worker found for task
      if (!worker) {
        continue;
      }

      // If worker has validate function, run validation
      if (worker.validate) {
        try {
          // Pass empty message and state since validation is time-based
          const isValid = await worker.validate(this.runtime, {} as Memory, {} as State);
          if (!isValid) {
            continue;
          }
        } catch (error) {
          logger.error(`[Bootstrap] Error validating task ${task.name}:`, error);
          continue;
        }
      }

      validatedTasks.push(task);
    }

    return validatedTasks;
  }

  /**
   * Asynchronous method that checks tasks with "queue" tag, validates and sorts them, then executes them based on interval and tags.
   *
   * @returns {Promise<void>} Promise that resolves once all tasks are checked and executed
   */
  private async checkTasks() {
    try {
      // Get all tasks with "queue" tag
      const allTasks = await this.runtime.getTasks({
        tags: ['queue'],
      });

      // validate the tasks and sort them
      const tasks = await this.validateTasks(allTasks);

      const now = Date.now();

      for (const task of tasks) {
        // First check task.updatedAt (for newer task format)
        // Then fall back to task.metadata.updatedAt (for older tasks)
        // Finally default to 0 if neither exists
        let taskStartTime: number;

        // if tags does not contain "repeat", execute immediately
        if (!task.tags?.includes('repeat')) {
          // does not contain repeat
          await this.executeTask(task);
          continue;
        }

        if (typeof task.updatedAt === 'number') {
          taskStartTime = task.updatedAt;
        } else if (task.metadata?.updatedAt && typeof task.metadata.updatedAt === 'number') {
          taskStartTime = task.metadata.updatedAt;
        } else if (task.updatedAt) {
          taskStartTime = new Date(task.updatedAt).getTime();
        } else {
          taskStartTime = 0; // Default to immediate execution if no timestamp found
        }

        // Get updateInterval from metadata
        const updateIntervalMs = task.metadata?.updateInterval ?? 0; // update immediately

        // if tags does not contain "repeat", execute immediately
        if (!task.tags?.includes('repeat')) {
          await this.executeTask(task);
          continue;
        }

        if (task.metadata?.updatedAt === task.metadata?.createdAt) {
          if (task.tags?.includes('immediate')) {
            logger.debug('[Bootstrap] Immediately running task', task.name);
            await this.executeTask(task);
            continue;
          }
        }

        // Check if enough time has passed since last update
        if (now - taskStartTime >= updateIntervalMs) {
          logger.debug(
            `[Bootstrap] Executing task ${task.name} - interval of ${updateIntervalMs}ms has elapsed`
          );
          await this.executeTask(task);
        }
      }
    } catch (error) {
      logger.error('[Bootstrap] Error checking tasks:', error);
    }
  }

  /**
   * Executes a given task asynchronously.
   *
   * @param {Task} task - The task to be executed.
   */
  private async executeTask(task: Task) {
    try {
      if (!task || !task.id) {
        logger.debug(`[Bootstrap] Task not found`);
        return;
      }

      const worker = this.runtime.getTaskWorker(task.name);
      if (!worker) {
        logger.debug(`[Bootstrap] No worker found for task type: ${task.name}`);
        return;
      }

      // Handle repeating vs non-repeating tasks
      if (task.tags?.includes('repeat')) {
        // For repeating tasks, update the updatedAt timestamp
        await this.runtime.updateTask(task.id, {
          metadata: {
            ...task.metadata,
            updatedAt: Date.now(),
          },
        });
        logger.debug(
          `[Bootstrap] Updated repeating task ${task.name} (${task.id}) with new timestamp`
        );
      }

      logger.debug(`[Bootstrap] Executing task ${task.name} (${task.id})`);
      await worker.execute(this.runtime, task.metadata || {}, task);
      //logger.debug('task.tags are', task.tags);

      // Handle repeating vs non-repeating tasks
      if (!task.tags?.includes('repeat')) {
        // For non-repeating tasks, delete the task after execution
        await this.runtime.deleteTask(task.id);
        logger.debug(
          `[Bootstrap] Deleted non-repeating task ${task.name} (${task.id}) after execution`
        );
      }
    } catch (error) {
      logger.error(`[Bootstrap] Error executing task ${task.id}:`, error);
    }
  }

  /**
   * Stops the TASK service in the given agent runtime.
   *
   * @param {IAgentRuntime} runtime - The agent runtime containing the service.
   * @returns {Promise<void>} - A promise that resolves once the service has been stopped.
   */
  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(ServiceType.TASK);
    if (service) {
      await service.stop();
    }
  }

  /**
   * Stops the timer if it is currently running.
   */

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
```
