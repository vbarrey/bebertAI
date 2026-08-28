export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;

  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaChatRequest {
  model: string;
  messages: {
    role: string;
    content: string;
  }[];
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    thinking: string;
    tool_calls: [
      {
        function: {
          name: string;
          description: string;
          arguments: string;
        };
      }
    ];
    images: string[];
  };
  done: boolean;

  done_reason: string;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
  logprobs: {
    token: string;
    logprob: number;
    bytes: number[];
    top_logprobs: {
      token: string;
      logprob: number;
      bytes: number[];
    }[];
  }[];
}

export interface OllamaChatChunk {
  model: string;
  created_at: string;
  message: {
    role: "user" | "assistant" | "system";
    content: string;
  };
  done: boolean;
}

export interface OllamaEmbedRequest {
  model: string;
  input: string[];
}

export interface OllamaEmbedResponse {
  embeddings: number[][];
}
