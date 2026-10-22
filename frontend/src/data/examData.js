// Dummy Data for Athena AI Smart Proctoring System

export const sampleStudent = {
  name: "Alex Johnson",
  studentId: "STU-2024-8891",
  course: "CS-402: Advanced Software Engineering",
  email: "alex.johnson@university.edu",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
};

export const mcqQuestions = [
  {
    id: 1,
    question: "In React 18, which hook should be used to subscribe to an external store in a concurrent-safe manner?",
    category: "React Architecture",
    points: 10,
    options: [
      "useSyncExternalStore",
      "useConcurrentStore",
      "useExternalState",
      "useSubscriptionStore"
    ],
    correctAnswer: 0
  },
  {
    id: 2,
    question: "What is the average time complexity of searching for an element in a balanced Binary Search Tree (BST) with N nodes?",
    category: "Data Structures",
    points: 10,
    options: [
      "O(1)",
      "O(log N)",
      "O(N)",
      "O(N log N)"
    ],
    correctAnswer: 1
  },
  {
    id: 3,
    question: "Which HTTP header is specifically designed to mitigate Cross-Site Scripting (XSS) attacks by controlling resources loaded by the browser?",
    category: "Web Security",
    points: 10,
    options: [
      "X-Frame-Options",
      "Strict-Transport-Security",
      "Content-Security-Policy",
      "Access-Control-Allow-Origin"
    ],
    correctAnswer: 2
  },
  {
    id: 4,
    question: "In Node.js event loop architecture, which phase executes callbacks registered with setImmediate()?",
    category: "System Engineering",
    points: 10,
    options: [
      "Timers Phase",
      "Pending Callbacks Phase",
      "Poll Phase",
      "Check Phase"
    ],
    correctAnswer: 3
  },
  {
    id: 5,
    question: "What is the primary function of tf.tidy() in TensorFlow.js WebGL memory management?",
    category: "Machine Learning / TF.js",
    points: 10,
    options: [
      "Cleans up intermediate GPU WebGL tensors after execution to prevent memory leaks",
      "Optimizes neural network weight gradients during backpropagation",
      "Converts 2D canvas pixels into 3D WebGL tensor matrices",
      "Serializes model weights into JSON format for localStorage storage"
    ],
    correctAnswer: 0
  },
  {
    id: 6,
    question: "In relational database indexing, how does a B+ Tree index optimize range-based SQL queries compared to a standard B-Tree?",
    category: "Database Engineering",
    points: 10,
    options: [
      "All data records are stored exclusively in leaf nodes linked sequentially via pointers",
      "Internal non-leaf nodes store complete row data payloads for direct lookup",
      "It eliminates hash collisions by applying MD5 checksums on primary keys",
      "It compresses index keys using LZW dictionary encoding"
    ],
    correctAnswer: 0
  },
  {
    id: 7,
    question: "Which CSS Grid property value creates responsive column layouts without requiring CSS media queries?",
    category: "Modern Frontend",
    points: 10,
    options: [
      "grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));",
      "grid-auto-flow: column dense;",
      "column-width: auto-fill;",
      "flex-wrap: wrap-responsive;"
    ],
    correctAnswer: 0
  },
  {
    id: 8,
    question: "What security role does PKCE (Proof Key for Code Exchange) play in OAuth 2.0 Authorization Code flows for Mobile and SPA clients?",
    category: "Authentication & Security",
    points: 10,
    options: [
      "Prevents authorization code injection and interception attacks on public clients without client secrets",
      "Encrypts JWT payload signature using RSA-4096 asymmetric keys",
      "Bypasses CORS restrictions on cross-origin token exchange requests",
      "Automatically revokes refresh tokens after 15 minutes of inactivity"
    ],
    correctAnswer: 0
  },
  {
    id: 9,
    question: "In CPU Virtual Memory Management, what is the primary role of the Translation Lookaside Buffer (TLB)?",
    category: "Operating Systems",
    points: 10,
    options: [
      "Hardware cache used by the MMU to accelerate virtual-to-physical address translation",
      "Software buffer storing thread execution stacks in kernel space",
      "L3 cache controller managing multi-core DMA bus arbitration",
      "Interrupt vector table storing page fault handler memory addresses"
    ],
    correctAnswer: 0
  },
  {
    id: 10,
    question: "Which HTTP header pattern allows microservice APIs to guarantee Idempotency on repeated financial POST transactions?",
    category: "Distributed Systems",
    points: 10,
    options: [
      "Idempotency-Key",
      "X-Transaction-Nonce",
      "Cache-Control: no-repeat",
      "ETag-Match-Strict"
    ],
    correctAnswer: 0
  }
];

export const codingProblems = [
  {
    id: 1,
    title: "1. Two Sum Problem",
    difficulty: "Easy",
    timeLimit: "1.0s",
    memoryLimit: "256MB",
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.`,
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists."
    ],
    sampleInput: `nums = [2, 7, 11, 15], target = 9`,
    sampleOutput: `[0, 1]`,
    explanation: `Because nums[0] + nums[1] == 2 + 7 == 9, we return [0, 1].`,
    starterCode: {
      javascript: `function twoSum(nums, target) {\n    // Write your code here\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const diff = target - nums[i];\n        if (map.has(diff)) {\n            return [map.get(diff), i];\n        }\n        map.set(nums[i], i);\n    }\n    return [];\n}`,
      python: `def twoSum(nums, target):\n    # Write your code here\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []`,
      cpp: `#include <vector>\n#include <unordered_map>\n\nclass Solution {\npublic:\n    std::vector<int> twoSum(std::vector<int>& nums, int target) {\n        std::unordered_map<int, int> map;\n        for (int i = 0; i < nums.size(); i++) {\n            int diff = target - nums[i];\n            if (map.find(diff) != map.end()) {\n                return {map.find(diff)->second, i};\n            }\n            map[nums[i]] = i;\n        }\n        return {};\n    }\n};`,
      java: `import java.util.HashMap;\n\nclass Solution {\n    public int[] twoSum(int[] nums, int target) {\n        HashMap<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int diff = target - nums[i];\n            if (map.containsKey(diff)) {\n                return new int[] { map.get(diff), i };\n            }\n            map.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}`,
      c: `#include <stdlib.h>\n\nint* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    *returnSize = 2;\n    int* result = (int*)malloc(2 * sizeof(int));\n    for (int i = 0; i < numsSize; i++) {\n        for (int j = i + 1; j < numsSize; j++) {\n            if (nums[i] + nums[j] == target) {\n                result[0] = i;\n                result[1] = j;\n                return result;\n            }\n        }\n    }\n    return result;\n}`
    }
  },
  {
    id: 2,
    title: "2. Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    timeLimit: "1.5s",
    memoryLimit: "256MB",
    description: `Given a string s, find the length of the **longest substring** without repeating characters.`,
    constraints: [
      "0 <= s.length <= 5 * 10^4",
      "`s` consists of English letters, digits, symbols and spaces."
    ],
    sampleInput: `s = "abcabcbb"`,
    sampleOutput: `3`,
    explanation: `The answer is "abc", with the length of 3.`,
    starterCode: {
      javascript: `function lengthOfLongestSubstring(s) {\n    let set = new Set();\n    let left = 0, maxLen = 0;\n    for (let right = 0; right < s.length; right++) {\n        while (set.has(s[right])) {\n            set.delete(s[left]);\n            left++;\n        }\n        set.add(s[right]);\n        maxLen = Math.max(maxLen, right - left + 1);\n    }\n    return maxLen;\n}`,
      python: `def lengthOfLongestSubstring(s: str) -> int:\n    char_set = set()\n    left = 0\n    max_len = 0\n    for right in range(len(s)):\n        while s[right] in char_set:\n            char_set.remove(s[left])\n            left += 1\n        char_set.add(s[right])\n        max_len = max(max_len, right - left + 1)\n    return max_len`,
      cpp: `#include <string>\n#include <unordered_set>\n#include <algorithm>\n\nclass Solution {\npublic:\n    int lengthOfLongestSubstring(std::string s) {\n        std::unordered_set<char> set;\n        int left = 0, maxLen = 0;\n        for (int right = 0; right < s.length(); right++) {\n            while (set.count(s[right])) {\n                set.erase(s[left]);\n                left++;\n            }\n            set.insert(s[right]);\n            maxLen = std::max(maxLen, right - left + 1);\n        }\n        return maxLen;\n    }\n};`,
      java: `import java.util.HashSet;\n\nclass Solution {\n    public int lengthOfLongestSubstring(String s) {\n        HashSet<Character> set = new HashSet<>();\n        int left = 0, maxLen = 0;\n        for (int right = 0; right < s.length(); right++) {\n            while (set.contains(s.charAt(right))) {\n                set.remove(s.charAt(left));\n                left++;\n            }\n            set.add(s.charAt(right));\n            maxLen = Math.max(maxLen, right - left + 1);\n        }\n        return maxLen;\n    }\n}`,
      c: `#include <string.h>\n#include <stdio.h>\n\nint lengthOfLongestSubstring(char * s){\n    int n = strlen(s);\n    int maxLen = 0, left = 0;\n    int lastSeen[256];\n    memset(lastSeen, -1, sizeof(lastSeen));\n    for (int right = 0; right < n; right++) {\n        if (lastSeen[(unsigned char)s[right]] >= left) {\n            left = lastSeen[(unsigned char)s[right]] + 1;\n        }\n        lastSeen[(unsigned char)s[right]] = right;\n        int len = right - left + 1;\n        if (len > maxLen) maxLen = len;\n    }\n    return maxLen;\n}`
    }
  }
];

export const theoryQuestions = [
  {
    id: 1,
    title: "Question 1: Microservices Architecture & System Reliability",
    marks: 20,
    minWords: 150,
    prompt: "Discuss the key differences between Monolithic and Microservice software architectures. Elaborate on Circuit Breaker and Rate Limiting patterns used to ensure system fault tolerance under high traffic spikes.",
    placeholder: "Write your architectural analysis here. Focus on API Gateway routing, database per service strategies, and fault isolation mechanisms..."
  },
  {
    id: 2,
    title: "Question 2: Web Application Security & Threat Mitigation",
    marks: 20,
    minWords: 150,
    prompt: "Compare HTTP SameSite Cookie attributes (Strict vs Lax vs None) against LocalStorage for JWT storage. How does Content Security Policy (CSP) prevent inline script injection in modern single-page apps?",
    placeholder: "Explain XSS vs CSRF vectors, HttpOnly flag protection, and nonce-based CSP headers in enterprise web applications..."
  }
];
