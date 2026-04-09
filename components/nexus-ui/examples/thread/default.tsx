"use client";

import {
  Message,
  MessageContent,
  MessageMarkdown,
  MessageStack,
} from "@/components/nexus-ui/message";
import {
  Thread,
  ThreadContent,
  ThreadScrollToBottom,
} from "@/components/nexus-ui/thread";

const turns = [
  {
    from: "user" as const,
    text: "I'm visiting Chicago for a long weekend—what's worth doing if I've never been?",
  },
  {
    from: "assistant" as const,
    text: "Start with the lakefront and Millennium Park for an easy first day.\n\nIf the weather stays calm, a short architecture boat tour is a nice add-on. Weekend departures fill up, so book a day ahead if you care about the time slot.",
  },
  {
    from: "user" as const,
    text: "I'm into food more than landmarks. Where should I eat?",
  },
  {
    from: "assistant" as const,
    text: "Reserve one night for classic **deep dish**, then keep lunches casual in whatever neighborhood you're exploring.",
  },
  {
    from: "user" as const,
    text: "Is public transit enough, or should I rent a car?",
  },
  {
    from: "assistant" as const,
    text: "The **L** trains and buses cover most visitor routes without much hassle.\n\nRent a car only if you plan to leave the city every day. Downtown parking and hotel garages add up, so defaulting to transit usually saves money.",
  },
  {
    from: "user" as const,
    text: "Any packing tip for April weather?",
  },
  {
    from: "assistant" as const,
    text: "Pack layers and a light rain jacket; spring weather can swing between chilly mornings and warm afternoons.",
  },
  {
    from: "user" as const,
    text: "Perfect. I'll draft a loose plan and see what fits.",
  },
  {
    from: "assistant" as const,
    text: "Have a great trip!",
  },
] as const;

const ThreadDefault = () => {
  return (
    <Thread>
      <ThreadContent>
        {turns.map((turn, i) => (
          <Message key={i} from={turn.from}>
            <MessageStack>
              <MessageContent>
                <MessageMarkdown>{turn.text}</MessageMarkdown>
              </MessageContent>
            </MessageStack>
          </Message>
        ))}
      </ThreadContent>
      <ThreadScrollToBottom />
    </Thread>
  );
};

export default ThreadDefault;
