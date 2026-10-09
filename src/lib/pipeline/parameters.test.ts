import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultPipelineParameters } from "./default";
import { PipelineParametersSchema } from "./parameters";

describe("PipelineParametersSchema extraction", () => {
    it("accepts the defaults", () => {
        assert.deepEqual(
            PipelineParametersSchema.parse(defaultPipelineParameters),
            defaultPipelineParameters,
        );
    });

    it("fills the OCR fields of parameters stored before they existed", () => {
        const stored = JSON.parse(JSON.stringify(defaultPipelineParameters));
        stored.extraction = { ocrEnabled: true };

        assert.deepEqual(PipelineParametersSchema.parse(stored).extraction, {
            ocrEnabled: true,
            ocrMinCharsPerPage: 50,
            ocrLanguages: ["fra", "eng"],
        });
    });

    it("accepts any well-formed Tesseract language code", () => {
        const extraction = { ocrEnabled: true, ocrMinCharsPerPage: 50, ocrLanguages: ["deu", "rus", "deu_latf"] };

        assert.deepEqual(
            PipelineParametersSchema.parse({ ...defaultPipelineParameters, extraction }).extraction,
            extraction,
        );
    });

    it("rejects malformed languages, an empty language list and a negative threshold", () => {
        for (const extraction of [
            { ocrEnabled: true, ocrLanguages: ["fra; rm -rf /"] },
            { ocrEnabled: true, ocrLanguages: ["fra+eng"] },
            { ocrEnabled: true, ocrLanguages: ["../fra"] },
            { ocrEnabled: true, ocrLanguages: ["-l"] },
            { ocrEnabled: true, ocrLanguages: [] },
            { ocrEnabled: true, ocrMinCharsPerPage: -1 },
        ]) {
            assert.throws(() =>
                PipelineParametersSchema.parse({ ...defaultPipelineParameters, extraction }),
            );
        }
    });
});
