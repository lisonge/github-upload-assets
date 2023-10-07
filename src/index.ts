export interface Env {
    // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
    // MY_KV_NAMESPACE: KVNamespace;
    GITHUB: KVNamespace;
    //
    // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
    // MY_DURABLE_OBJECT: DurableObjectNamespace;
    //
    // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
    // MY_BUCKET: R2Bucket;
    //
    // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
    // MY_SERVICE: Fetcher;
}

import { uploadPoliciesAssets } from './github';

const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8',
};

const repositoryReg = /^[0-9a-zA-Z\-_]+\/[0-9a-zA-Z\-_]+$/;

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        if (request.method == 'OPTIONS') {
            return new Response(
                JSON.stringify({ message: 'allow all origin cors' }),
                {
                    headers: corsHeaders,
                }
            );
        }
        try {
            if (request.method != 'POST') {
                throw new Error('method must be POST');
            }
            const fd = await request.formData();
            const cookie = fd.get('cookie') || (await env.GITHUB.get('cookie'));
            if (!cookie) {
                throw new Error('not found cookie');
            }
            const repository =
                fd.get('repository') || (await env.GITHUB.get('repository'));
            if (!repository) {
                throw new Error('not found repository');
            }
            if (!repository.match(repositoryReg)) {
                throw new Error(
                    `repository must match ${repositoryReg.source}`
                );
            }

            const file = fd.get('file') as unknown as File | null;
            if (!file) {
                throw new Error('not found file');
            }
            const file_name = 'file.' + file.name.split('.').pop();
            const content_type = file_name.endsWith('.png')
                ? `image/png`
                : file_name.endsWith('.zip')
                ? 'application/x-zip-compressed'
                : file.type;

            const policiesAsset = await uploadPoliciesAssets(
                new File([file], file_name, { type: content_type }),
                cookie,
                `https://github.com/${repository}/issues/new`
            );
            return new Response(JSON.stringify(policiesAsset), {
                headers: corsHeaders,
            });
        } catch (e) {
            const e2 = e instanceof Error ? e : new Error(String(e));
            return new Response(
                JSON.stringify({
                    __error: true,
                    messsge: e2.message,
                }),
                {
                    headers: corsHeaders,
                }
            );
        }
    },
};
