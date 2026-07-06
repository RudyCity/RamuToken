import { expect, test, describe } from "bun:test";
import { textToImages, mergeConsecutiveMessages, compressToImage } from "../pipelines/image";
import { Message } from "../pipelines/caveman";

describe("Image Compression Pipeline", () => {
  describe("textToImages rendering utility", () => {
    test("should render text to base64 jpeg images", () => {
      const text = "Hello World! This is a test of RamuToken Image Compression.";
      const images = textToImages(text, {
        maxWidth: 800,
        fontSize: 12,
        format: "jpeg",
        quality: 80,
        linesPerPage: 50,
      });

      expect(images.length).toBe(1);
      expect(typeof images[0]).toBe("string");
      // Check if it is a valid base64 string length
      expect(images[0].length).toBeGreaterThan(100);
    });

    test("should split text into multiple pages if it exceeds linesPerPage", () => {
      // Create 60 lines of text
      const text = Array.from({ length: 60 }, (_, i) => `Line number ${i + 1} - coding is fun`).join("\n");
      const images = textToImages(text, {
        maxWidth: 800,
        fontSize: 12,
        format: "png",
        quality: 90,
        linesPerPage: 25,
      });

      // 60 lines / 25 lines per page = 3 pages/images
      expect(images.length).toBe(3);
    });
  });

  describe("mergeConsecutiveMessages utility", () => {
    test("should merge consecutive user messages and align roles", () => {
      const messages: Message[] = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "User message 1" },
        { role: "user", content: "User message 2" },
        { role: "assistant", content: "Assistant reply 1" },
        { role: "tool", content: "Tool output 1" },
        { role: "user", content: "User message 3" },
      ];

      const merged = mergeConsecutiveMessages(messages);

      // Merging should happen:
      // - system is kept
      // - user 1 & user 2 merged -> user (User message 1 \n\n User message 2)
      // - assistant reply 1 -> assistant
      // - tool output 1 (treated as user) & user message 3 merged -> user (Tool output 1 \n\n User message 3)
      // Total 4 messages
      expect(merged.length).toBe(4);
      expect(merged[0].role).toBe("system");
      expect(merged[1].role).toBe("user");
      expect(merged[1].content).toBe("User message 1\n\nUser message 2");
      expect(merged[2].role).toBe("assistant");
      expect(merged[3].role).toBe("user");
      expect(merged[3].content).toBe("Tool output 1\n\nUser message 3");
    });

    test("should prefix with user Continue if first non-system message is assistant", () => {
      const messages: Message[] = [
        { role: "assistant", content: "I am assistant" }
      ];
      const merged = mergeConsecutiveMessages(messages);
      expect(merged.length).toBe(2);
      expect(merged[0].role).toBe("user");
      expect(merged[0].content).toBe("Continue");
      expect(merged[1].role).toBe("assistant");
    });
  });

  describe("compressToImage pipeline step", () => {
    test("should bypass if disabled", async () => {
      const messages: Message[] = [
        { role: "user", content: "Very long message content that would otherwise be compressed into an image." }
      ];

      const result = await compressToImage(messages, {
        enabled: false,
        triggerModels: ["gpt-4o"],
        minCharLength: 10,
        maxWidth: 800,
        fontSize: 12,
        format: "jpeg",
        quality: 80,
        linesPerPage: 50
      });

      expect(result).toEqual(messages);
    });

    test("should bypass if message is under minCharLength", async () => {
      const messages: Message[] = [
        { role: "user", content: "Short content" }
      ];

      const result = await compressToImage(messages, {
        enabled: true,
        triggerModels: ["gpt-4o"],
        minCharLength: 50,
        maxWidth: 800,
        fontSize: 12,
        format: "jpeg",
        quality: 80,
        linesPerPage: 50
      });

      expect(result).toEqual(messages);
    });

    test("should compress message content above minCharLength into base64 images", async () => {
      const messages: Message[] = [
        { role: "user", content: "This is a very long message that meets the length threshold for compression." }
      ];

      const result = await compressToImage(messages, {
        enabled: true,
        triggerModels: ["gpt-4o"],
        minCharLength: 10,
        maxWidth: 800,
        fontSize: 12,
        format: "jpeg",
        quality: 80,
        linesPerPage: 50
      });

      expect(result.length).toBe(1);
      const content = result[0].content;
      expect(Array.isArray(content)).toBe(true);
      expect(content[0].type).toBe("text");
      expect(content[1].type).toBe("image_url");
      expect(content[1].image_url.url).toContain("data:image/jpeg;base64,");
    });
  });
});
