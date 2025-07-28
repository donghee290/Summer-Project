import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { searchContent, SearchResultItem } from '../api/searchApi';

export const SearchPage = () => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);

  const handleSearch = async () => {
    if (!keyword) return;
    const res = await searchContent({ keyword });
    setResults(res.results);
  };

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold">검색</h1>
      <div className="flex gap-2 mb-4">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="검색어 입력"
          className="w-64 px-2 py-1 border rounded"
        />
        <Button onClick={handleSearch}>검색</Button>
      </div>
      <ul className="space-y-2">
        {results.map((item) => (
          <li key={item.id} className="p-2 border rounded">
            <div className="font-semibold">{item.title}</div>
            <div className="text-sm text-gray-600">{item.summary}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};