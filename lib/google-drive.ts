import { google, drive_v3 } from "googleapis";

const FOLDER_MIME = "application/vnd.google-apps.folder";

function getDriveClient(): drive_v3.Drive {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, or GOOGLE_REFRESH_TOKEN"
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return google.drive({
    version: "v3",
    auth: oauth2Client,
  });
}

function sanitizeFolderName(value: string): string {
  return value
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function listChildren(folderId: string): Promise<drive_v3.Schema$File[]> {
  const drive = getDriveClient();
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const res: { data: drive_v3.Schema$FileList } = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, webViewLink)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 1000,
      pageToken,
    });

    files.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

async function findChildFolderByName(
  parentId: string,
  name: string
): Promise<drive_v3.Schema$File | null> {
  const drive = getDriveClient();

  const res: { data: drive_v3.Schema$FileList } = await drive.files.list({
    q: [
      `'${parentId}' in parents`,
      `name = '${escapeDriveQueryValue(name)}'`,
      `mimeType = '${FOLDER_MIME}'`,
      "trashed = false",
    ].join(" and "),
    fields: "files(id, name, webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 10,
  });

  return res.data.files?.[0] ?? null;
}

async function createFolder(
  name: string,
  parentId: string
): Promise<{ id: string; name: string; webViewLink: string }> {
  const drive = getDriveClient();

  const res: { data: drive_v3.Schema$File } = await drive.files.create({
    supportsAllDrives: true,
    fields: "id, name, webViewLink",
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
  });

  if (!res.data.id) {
    throw new Error(`Failed to create folder: ${name}`);
  }

  return {
    id: res.data.id,
    name: res.data.name ?? name,
    webViewLink: res.data.webViewLink ?? "",
  };
}

async function copyFile(
  fileId: string,
  name: string,
  parentId: string
): Promise<drive_v3.Schema$File> {
  const drive = getDriveClient();

  const res: { data: drive_v3.Schema$File } = await drive.files.copy({
    fileId,
    supportsAllDrives: true,
    fields: "id, name, webViewLink, mimeType",
    requestBody: {
      name,
      parents: [parentId],
    },
  });

  return res.data;
}

type ProvisionResult = {
  rootFolderId: string;
  rootFolderName: string;
  rootFolderUrl: string;
  subfolders: Record<string, { id: string; url: string }>;
};

async function copyTemplateTree(
  templateFolderId: string,
  destinationFolderId: string,
  pathPrefix: string,
  subfolders: Record<string, { id: string; url: string }>
): Promise<void> {
  const children = await listChildren(templateFolderId);

  const folders = children
    .filter((item) => item.mimeType === FOLDER_MIME)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  const files = children
    .filter((item) => item.mimeType !== FOLDER_MIME)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  for (const folder of folders) {
    if (!folder.id || !folder.name) continue;

    const created = await createFolder(folder.name, destinationFolderId);
    const fullPath = pathPrefix ? `${pathPrefix}/${folder.name}` : folder.name;

    subfolders[fullPath] = {
      id: created.id,
      url: created.webViewLink,
    };

    await copyTemplateTree(folder.id, created.id, fullPath, subfolders);
  }

  for (const file of files) {
    if (!file.id || !file.name) continue;
    await copyFile(file.id, file.name, destinationFolderId);
  }
}

export async function provisionJobDriveFolder(
  jobNumber: string,
  jobName: string
): Promise<ProvisionResult> {
  const quotingParentId = process.env.GOOGLE_DRIVE_QUOTING_PARENT_ID;
  const templateRootId = process.env.GOOGLE_DRIVE_TEMPLATE_ROOT_ID;

  if (!quotingParentId) {
    throw new Error("Missing GOOGLE_DRIVE_QUOTING_PARENT_ID");
  }
  if (!templateRootId) {
    throw new Error("Missing GOOGLE_DRIVE_TEMPLATE_ROOT_ID");
  }

  const cleanJobNumber = sanitizeFolderName(jobNumber);
  const cleanJobName = sanitizeFolderName(jobName);

  if (!cleanJobNumber || !cleanJobName) {
    throw new Error("Job number and job name are required");
  }

  const folderName = `${cleanJobNumber} ${cleanJobName}`;

  const existing = await findChildFolderByName(quotingParentId, folderName);
  if (existing?.id) {
    return {
      rootFolderId: existing.id,
      rootFolderName: existing.name ?? folderName,
      rootFolderUrl: existing.webViewLink ?? "",
      subfolders: {},
    };
  }

  const root = await createFolder(folderName, quotingParentId);

  const subfolders: Record<string, { id: string; url: string }> = {};
  await copyTemplateTree(templateRootId, root.id, "", subfolders);

  return {
    rootFolderId: root.id,
    rootFolderName: root.name,
    rootFolderUrl: root.webViewLink,
    subfolders,
  };
}
