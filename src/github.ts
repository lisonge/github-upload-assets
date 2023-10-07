import { DomUtils, parseDocument } from 'htmlparser2';

const obj2form = (...objs: Record<string, unknown>[]) => {
    const fd = new FormData();
    objs.forEach((obj) => {
        for (const k in obj) {
            const v = obj[k];
            if (v === undefined) continue;
            if (v instanceof File) {
                fd.append(k, v, v.name);
            } else {
                fd.append(k, String(v));
            }
        }
    });
    return fd;
};

const commonHeaders = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 Edg/117.0.2045.47',
    origin: `https://github.com`,
};

const getCsrfTokenRepositoryId = async (cookie: string, csrfUrl: string) => {
    const resp = await fetch(csrfUrl, {
        headers: {
            ...commonHeaders,
            cookie,
        },
    });
    const text = await resp.text();
    const responseDoc = parseDocument(text);

    const fileAttachmentEl = DomUtils.findOne(
        (e) => {
            return (
                e.attribs['data-upload-policy-url'] == '/upload/policies/assets'
            );
        },
        responseDoc.children,
        true
    );
    if (!fileAttachmentEl) {
        throw new Error('not found file-attachment');
    }
    const repository_id = fileAttachmentEl.attribs['data-upload-repository-id'];
    if (!repository_id) {
        throw new Error('not found repository_id');
    }
    const authenticity_token = DomUtils.findOne(
        (e) =>
            (e.attribs['class'] || '').includes(
                'js-data-upload-policy-url-csrf'
            ),
        fileAttachmentEl.children,
        true
    )?.attribs?.value;
    if (!authenticity_token) {
        throw new Error('not found csrfToken');
    }
    return { repository_id, authenticity_token };
};

type S3Form = {
    key: string;
    acl: string;
    policy: string;
    'X-Amz-Algorithm': string;
    'X-Amz-Credential': string;
    'X-Amz-Date': string;
    'X-Amz-Signature': string;
    'Content-Type': string;
    'Cache-Control': string;
    'x-amz-meta-Surrogate-Control': string;
};
export type GithubPoliciesAsset = {
    id: number;
    name: string;
    size: number;
    content_type: string;
    original_name: string;
    href: string;
};

type UploadPoliciesAssetsRsonpse = {
    upload_url: string;
    header: {};
    asset: GithubPoliciesAsset;
    form: S3Form;
    same_origin: boolean;
    asset_upload_url: string;
    upload_authenticity_token: string;
    asset_upload_authenticity_token: string;
};

export const uploadPoliciesAssets = async (
    file: File,
    cookie: string,
    csrfUrl: string
) => {
    const { authenticity_token, repository_id } =
        await getCsrfTokenRepositoryId(cookie, csrfUrl);

    const policiesResp: UploadPoliciesAssetsRsonpse = await fetch(
        `https://github.com/upload/policies/assets`,
        {
            method: `POST`,
            body: obj2form({
                authenticity_token,
                content_type: file.type,
                name: file.name,
                size: file.size,
                repository_id,
            }),
            headers: {
                ...commonHeaders,
                cookie,
                referer: csrfUrl,
            },
        }
    ).then((r) => {
        if (!r.ok) {
            throw new Error(`failed upload policies assets`);
        }
        return r.json();
    });

    // violentmonkey success
    // tampermonkey failed https://github.com/Tampermonkey/tampermonkey/issues/1783
    // use fetch is also work, but console.error cors and can not get response
    const s3Resp = await fetch(policiesResp.upload_url, {
        method: `POST`,
        body: obj2form(policiesResp.form, {
            file,
        }),
        headers: {
            ...commonHeaders,
            cookie,
            referer: csrfUrl,
        },
    });
    if (!s3Resp.ok) {
        throw new Error(`upload s3 failed`);
    }

    const assetsResp = await fetch(
        new URL(policiesResp.asset_upload_url, `https://github.com/`).href,
        {
            method: `PUT`,
            body: obj2form({
                authenticity_token:
                    policiesResp.asset_upload_authenticity_token,
            }),
            headers: {
                ...commonHeaders,
                // api must add `Accept` request headers
                Accept: `application/json`,
                cookie,
                referer: csrfUrl,
            },
        }
    );

    if (assetsResp.status != 200) {
        throw new Error(`failed check authenticity upload`);
    }

    return policiesResp.asset;
};
