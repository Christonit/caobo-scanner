<template>
  <div
    class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
  >
    <div class="px-6 py-12">
      <!-- Header -->
      <header class="mb-12 max-w-7xl mx-auto">
        <h1
          class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tight"
        >
          Receipt Processor
        </h1>
        <p class="mt-2 text-slate-400 text-lg">
          Upload, process, and export your receipts
        </p>
      </header>

      <!-- File Upload Area -->
      <div class="max-w-4xl mx-auto mb-10">
        <div
          class="group relative border-2 border-dashed border-slate-600 rounded-2xl p-12 text-center bg-slate-800/50 backdrop-blur transition-all duration-300 hover:border-emerald-500/70 hover:bg-slate-800/80 cursor-pointer"
          @drop="handleDrop"
          @dragover.prevent
          @dragenter.prevent
          @click="$refs.fileInput.click()"
        >
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            @change="handleFileSelect"
            class="hidden"
          />
          <div class="space-y-4">
            <div
              class="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
            >
              <svg
                class="w-8 h-8 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <p class="text-slate-300 text-lg">Drag and drop files here or</p>
              <button
                @click.stop="$refs.fileInput.click()"
                class="mt-3 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:-translate-y-0.5"
              >
                Select Files
              </button>
            </div>
            <p class="text-sm text-slate-500">Supports: PDF, PNG, JPG, JPEG</p>
          </div>
        </div>
      </div>

      <!-- File List - Full Width -->
      <div
        v-if="files.length > 0"
        class="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden"
      >
        <div class="px-6 py-5 border-b border-slate-700/50">
          <h2 class="text-xl font-semibold text-slate-200">
            Selected Files
            <span
              class="ml-2 px-2.5 py-1 text-sm bg-slate-700 rounded-full text-slate-300"
              >{{ files.length }}</span
            >
          </h2>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-900/50">
              <tr>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  File Name
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Date
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Vendor / Description
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Total
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Tax
                </th>
                <th
                  class="px-4 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Preview
                </th>
                <th
                  class="px-4 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700/50">
              <tr
                v-for="file in files"
                :key="file.id"
                class="hover:bg-slate-700/30 transition-colors duration-150"
                :class="{ 'bg-amber-900/10': isEdited(file) }"
              >
                <!-- File Name -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.filename"
                    @focus="startEditing(file)"
                    class="w-full bg-transparent text-slate-300 font-medium border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                  />
                </td>
                <!-- Status -->
                <td class="px-4 py-3">
                  <span
                    class="inline-flex px-3 py-1 text-xs font-semibold rounded-full"
                    :class="getStatusClasses(file.status)"
                  >
                    {{ getStatusLabel(file.status) }}
                  </span>
                </td>
                <!-- Date -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.date"
                    @focus="startEditing(file)"
                    class="w-full bg-transparent text-slate-400 border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                    placeholder="-"
                  />
                </td>
                <!-- Vendor / Description -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.vendor"
                    @focus="startEditing(file)"
                    class="w-full bg-transparent text-slate-400 border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                    placeholder="-"
                  />
                </td>
                <!-- Total -->
                <td class="px-4 py-3">
                  <div class="flex items-center">
                    <span class="text-slate-500 mr-1">$</span>
                    <input
                      type="text"
                      v-model="file.editableData.total"
                      @focus="startEditing(file)"
                      class="w-24 bg-transparent text-slate-300 font-mono border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                      placeholder="-"
                    />
                  </div>
                </td>
                <!-- Tax -->
                <td class="px-4 py-3">
                  <div class="flex items-center">
                    <span class="text-slate-500 mr-1">$</span>
                    <input
                      type="text"
                      v-model="file.editableData.tax"
                      @focus="startEditing(file)"
                      class="w-20 bg-transparent text-slate-400 font-mono border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                      placeholder="-"
                    />
                  </div>
                </td>
                <!-- Preview Button -->
                <td class="px-4 py-3 text-center">
                  <button
                    @click="openPreview(file)"
                    class="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Preview file"
                  >
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </button>
                </td>
                <!-- Actions -->
                <td class="px-4 py-3 text-center">
                  <div class="flex items-center justify-center gap-2">
                    <!-- Revert Button (only visible if edited) -->
                    <button
                      v-if="isEdited(file)"
                      @click="revertFile(file)"
                      class="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 transition-colors"
                      title="Revert changes"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                        />
                      </svg>
                    </button>
                    <!-- Remove Button -->
                    <button
                      @click="removeFile(file)"
                      class="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                      title="Remove file"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Actions -->
        <div
          class="px-6 py-5 border-t border-slate-700/50 flex flex-wrap gap-3"
        >
          <button
            @click="processAll"
            :disabled="processing || files.every((f) => f.status !== 'pending')"
            class="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-emerald-500/25"
          >
            {{ processing ? "Processing..." : "Process All Files" }}
          </button>
          <button
            v-if="files.some((f) => f.status === 'done')"
            @click="downloadExcel"
            class="px-6 py-2.5 bg-slate-700 text-slate-200 font-semibold rounded-lg hover:bg-slate-600 transition-all duration-300 border border-slate-600"
          >
            Download Excel
          </button>
          <button
            @click="clearFiles"
            class="px-6 py-2.5 bg-transparent text-slate-400 font-semibold rounded-lg hover:bg-slate-700/50 hover:text-slate-200 transition-all duration-300 border border-slate-600"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>

    <!-- Lightbox Preview Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="previewFile"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          @click.self="closePreview"
        >
          <div class="relative max-w-5xl max-h-[90vh] w-full">
            <!-- Close Button -->
            <button
              @click="closePreview"
              class="absolute -top-12 right-0 p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <!-- File name -->
            <div class="absolute -top-12 left-0 text-slate-300 font-medium">
              {{ previewFile.name }}
            </div>

            <!-- Image Preview -->
            <div
              v-if="isImageFile(previewFile)"
              class="bg-slate-900 rounded-xl overflow-hidden shadow-2xl"
            >
              <img
                :src="previewUrl"
                :alt="previewFile.name"
                class="max-h-[85vh] w-auto mx-auto object-contain"
              />
            </div>

            <!-- PDF Notice -->
            <div
              v-else
              class="bg-slate-800 rounded-xl p-12 text-center shadow-2xl"
            >
              <svg
                class="w-20 h-20 mx-auto text-red-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 class="text-xl font-semibold text-slate-200 mb-2">
                PDF File
              </h3>
              <p class="text-slate-400">{{ previewFile.name }}</p>
              <p class="text-slate-500 text-sm mt-2">
                PDF preview not available in lightbox
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const API_BASE = "http://localhost:8000";

const fileInput = ref(null);
const files = ref([]);
const processing = ref(false);
const previewFile = ref(null);
const previewUrl = ref(null);
let fileIdCounter = 0;

const handleFileSelect = (event) => {
  const selectedFiles = Array.from(event.target.files);
  addFiles(selectedFiles);
  event.target.value = "";
};

const handleDrop = (event) => {
  event.preventDefault();
  const droppedFiles = Array.from(event.dataTransfer.files);
  addFiles(droppedFiles);
};

const addFiles = (fileList) => {
  fileList.forEach((file) => {
    const validTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];
    if (!validTypes.includes(file.type)) {
      alert(`${file.name} is not a supported file type`);
      return;
    }

    const fileItem = {
      id: fileIdCounter++,
      name: file.name,
      file: file,
      status: "pending",
      data: null,
      originalData: null,
      editableData: {
        filename: file.name,
        date: "",
        vendor: "",
        total: "",
        tax: "",
      },
    };
    files.value.push(fileItem);
  });
};

const startEditing = (file) => {
  // Save original state if not already saved
  if (!file.originalData) {
    file.originalData = { ...file.editableData };
  }
};

const isEdited = (file) => {
  if (!file.originalData) return false;
  return (
    file.editableData.filename !== file.originalData.filename ||
    file.editableData.date !== file.originalData.date ||
    file.editableData.vendor !== file.originalData.vendor ||
    file.editableData.total !== file.originalData.total ||
    file.editableData.tax !== file.originalData.tax
  );
};

const revertFile = (file) => {
  if (file.originalData) {
    file.editableData = { ...file.originalData };
  }
};

const removeFile = (file) => {
  const index = files.value.findIndex((f) => f.id === file.id);
  if (index > -1) {
    files.value.splice(index, 1);
  }
};

const isImageFile = (file) => {
  return file.file.type.startsWith("image/");
};

const openPreview = (file) => {
  previewFile.value = file;
  if (isImageFile(file)) {
    previewUrl.value = URL.createObjectURL(file.file);
  }
};

const closePreview = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewFile.value = null;
  previewUrl.value = null;
};

const getStatusLabel = (status) => {
  const labels = {
    pending: "Pending",
    processing: "Processing",
    done: "Done",
    duplicate: "Duplicate",
    error: "Error",
  };
  return labels[status] || status;
};

const getStatusClasses = (status) => {
  const classes = {
    pending: "bg-amber-500/20 text-amber-400",
    processing: "bg-blue-500/20 text-blue-400 animate-pulse",
    done: "bg-emerald-500/20 text-emerald-400",
    duplicate: "bg-orange-500/20 text-orange-400",
    error: "bg-red-500/20 text-red-400",
  };
  return classes[status] || "bg-slate-500/20 text-slate-400";
};

const processAll = async () => {
  processing.value = true;

  for (const fileItem of files.value) {
    if (fileItem.status !== "pending") continue;

    fileItem.status = "processing";

    try {
      const formData = new FormData();
      formData.append("file", fileItem.file);

      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.status === "duplicate") {
        fileItem.status = "duplicate";
      } else if (result.status === "success") {
        fileItem.status = "done";
        fileItem.data = result.data;

        // Update editable data with extracted values
        fileItem.editableData = {
          filename: fileItem.name,
          date: result.data.date || "",
          vendor: result.data.vendor || result.data.description || "",
          total: result.data.total ? result.data.total.toString() : "",
          tax: result.data.tax ? result.data.tax.toString() : "",
        };

        // Save as original for revert functionality
        fileItem.originalData = { ...fileItem.editableData };
      } else {
        fileItem.status = "error";
      }
    } catch (error) {
      console.error("Error processing file:", error);
      fileItem.status = "error";
    }
  }

  processing.value = false;
};

const downloadExcel = async () => {
  try {
    const response = await fetch(`${API_BASE}/download`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "processed_receipts.xlsx";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Error downloading file:", error);
    alert("Error downloading Excel file");
  }
};

const clearFiles = () => {
  files.value = [];
  if (fileInput.value) {
    fileInput.value.value = "";
  }
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
