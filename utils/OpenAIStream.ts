import {
  createParser,
  ParsedEvent,
  ReconnectInterval,
} from "eventsource-parser";
import { NextFetchEvent, NextRequest } from "next/server";

export type ChatGPTAgent = "user" | "system";

export interface ChatGPTMessage {
  role: ChatGPTAgent;
  content: string;
}

export interface OpenAIStreamPayload {
  model: string;
  messages: ChatGPTMessage[];
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  stream: boolean;
  n: number;
}

export async function OpenAIStream(payload: OpenAIStreamPayload) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  let fullResponse = "";

  const readableStream = res.body;

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const parser = createParser(
        async (event: ParsedEvent | ReconnectInterval) => {
          if (event.type === "event") {
            const data = event.data;

            if (data === "[DONE]") {
              console.log("done, signaling end of stream...");
              controller.terminate(); // terminate transformstream
              return;
            }

            try {
              console.log("parsing data: ", data);
              const json = JSON.parse(data);
              console.log("succesfully parsed data: ", json);
              const text = json.choices[0].delta?.content || "";
              fullResponse += text;
              if (fullResponse.length > 20) {
                console.log("transforming response: ", fullResponse);
                // simulate async process
                const transformedResponse = await new Promise((resolve) =>
                  setTimeout(() => resolve(fullResponse.toUpperCase()), 1000)
                );
                console.log("transformed response: ", transformedResponse);
                controller.enqueue(encoder.encode(transformedResponse + "\n"));
                fullResponse = "";
              }
            } catch (e) {
              // maybe parse error
              controller.error(e);
            }
          }
        }
      );

      // feed the chunk to the parser
      parser.feed(decoder.decode(chunk));
    },
  });

  return readableStream?.pipeThrough(transformStream);
}
